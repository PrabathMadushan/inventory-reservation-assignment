import type { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import request from 'supertest';
import type { App } from 'supertest/types';
import { AppModule } from '../src/app.module';
import { configureApp } from '../src/configure-app';
import { PrismaService } from '../src/prisma/prisma.service';
import { demoProducts } from '../prisma/seed-data';
import type { serializeOrder } from '../src/orders/order.serializer';

type Order = ReturnType<typeof serializeOrder>;
type Page = { items: Order[]; page: number; pageSize: number; total: number };
describe('Operations order reads (real PostgreSQL and role guards)', () => {
  let app: INestApplication<App>;
  let db: PrismaService;
  let alice: string;
  let bob: string;
  let ops: string;
  let secret: string;
  let first: Order;
  let second: Order;
  async function reset() {
    await db.$transaction(async (tx) => {
      await tx.$executeRaw`TRUNCATE TABLE payment_events, order_transitions, order_idempotency, orders`;
      for (const product of demoProducts)
        await tx.product.update({ where: { id: product.id }, data: product });
    });
  }
  beforeAll(async () => {
    const module = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();
    app = module.createNestApplication();
    configureApp(app);
    await app.init();
    db = app.get(PrismaService);
    [alice, bob, ops] = await Promise.all(
      ['user-alice', 'user-bob', 'user-ops'].map((sub) =>
        app.get(JwtService).signAsync({ sub }),
      ),
    );
    secret = app.get(ConfigService).getOrThrow<string>('WEBHOOK_SECRET');
  }, 30000);
  beforeEach(async () => {
    await reset();
    async function create(token: string, key: string) {
      const response = await request(app.getHttpServer())
        .post('/api/orders')
        .auth(token, { type: 'bearer' })
        .set('Idempotency-Key', key)
        .send({ productId: 'product-keyboard', quantity: 1 })
        .expect(201);
      return response.body as Order;
    }
    first = await create(alice, 'alice');
    second = await create(bob, 'bob');
    await request(app.getHttpServer())
      .post('/api/webhooks/payments')
      .set('X-Webhook-Secret', secret)
      .send({
        eventId: 'confirmed',
        orderId: second.id,
        type: 'PAYMENT_SUCCEEDED',
      })
      .expect(200);
    await db.order.updateMany({
      data: { createdAt: new Date('2026-01-01T00:00:00.000Z') },
    });
  });
  afterAll(async () => {
    if (db) await reset();
    await app?.close();
  });
  function get(path = '', token = ops) {
    return request(app.getHttpServer())
      .get(`/api/operations/orders${path}`)
      .auth(token, { type: 'bearer' });
  }
  it('reads all customers, exact public contracts/history, matching totals and stable timestamp ties', async () => {
    const page = (await get().expect(200)).body as Page;
    expect(Object.keys(page).sort()).toEqual([
      'items',
      'page',
      'pageSize',
      'total',
    ]);
    expect(page.page).toBe(1);
    expect(page.pageSize).toBe(10);
    expect(page.total).toBe(2);
    expect(page.items.map((x) => x.customerId).sort()).toEqual([
      'user-alice',
      'user-bob',
    ]);
    expect(page.items.map((x) => x.id)).toEqual(
      [first.id, second.id].sort().reverse(),
    );
    for (const item of page.items) {
      expect(Object.keys(item).sort()).toEqual(Object.keys(first).sort());
      expect(typeof item.totalMinor).toBe('number');
      expect(item.createdAt).toMatch(/Z$/);
      expect((await get(`/${item.id}`).expect(200)).body as Order).toEqual(
        item,
      );
    }
    const confirmed = page.items.find((x) => x.id === second.id)!;
    expect(confirmed.history.map((x) => x.reason)).toEqual([
      'ORDER_CREATED',
      'PAYMENT_SUCCEEDED',
    ]);
    expect(JSON.stringify(page)).not.toMatch(
      /password|hash|sequence|retry|eventId/,
    );
  });
  it.each(['PENDING', 'CONFIRMED', 'FAILED', 'CANCELLED'])(
    'filters uppercase %s with matching count',
    async (status) => {
      const page = (await get(`?status=${status}`).expect(200)).body as Page;
      expect(page.total).toBe(
        status === 'PENDING' || status === 'CONFIRMED' ? 1 : 0,
      );
      expect(page.items.every((x) => x.status === status)).toBe(true);
      expect(page.items.length).toBe(page.total);
    },
  );
  it('uses server pagination, accepts cap 100, and returns huge beyond-end pages empty', async () => {
    const one = (await get('?pageSize=1').expect(200)).body as Page;
    const two = (await get('?page=2&pageSize=1').expect(200)).body as Page;
    expect([one.items[0].id, two.items[0].id]).toEqual(
      [first.id, second.id].sort().reverse(),
    );
    expect(one.total).toBe(2);
    expect(two.total).toBe(2);
    expect(
      (await get('?page=9007199254740991&pageSize=100').expect(200))
        .body as Page,
    ).toEqual({
      items: [],
      page: Number.MAX_SAFE_INTEGER,
      pageSize: 100,
      total: 2,
    });
  });
  it.each([
    'page=0',
    'page=1.2',
    'pageSize=101',
    'status=pending',
    'status=UNKNOWN',
    'customerId=user-alice',
    'page=1&page=2',
  ])('rejects invalid query %s', async (query) => {
    await get(`?${query}`).expect(400);
  });
  it.each(['', '/unknown-id'])(
    'requires valid identity and operations role on %s',
    async (path) => {
      await request(app.getHttpServer())
        .get(`/api/operations/orders${path}`)
        .expect(401);
      await get(path, alice).expect(403);
      await get(path, bob).expect(403);
      await get(path, 'invalid-token').expect(401);
    },
  );
  it('allows operations both customers details but preserves customer ownership and reverse role boundaries', async () => {
    await get(`/${first.id}`).expect(200);
    await get(`/${second.id}`).expect(200);
    await get('/unknown-id').expect(404);
    await request(app.getHttpServer())
      .get(`/api/orders/${second.id}`)
      .auth(alice, { type: 'bearer' })
      .expect(404);
    await request(app.getHttpServer())
      .get('/api/orders')
      .auth(ops, { type: 'bearer' })
      .expect(403);
    await request(app.getHttpServer())
      .post(`/api/orders/${first.id}/cancel`)
      .auth(ops, { type: 'bearer' })
      .send({})
      .expect(403);
    const own = (
      await request(app.getHttpServer())
        .get('/api/orders')
        .auth(alice, { type: 'bearer' })
        .expect(200)
    ).body as Page;
    expect(own.total).toBe(1);
    expect(own.items[0].id).toBe(first.id);
    expect(
      (
        await db.product.findUniqueOrThrow({
          where: { id: 'product-keyboard' },
        })
      ).availableQuantity,
    ).toBe(18n);
    expect(await db.order.count()).toBe(2);
    expect(await db.orderTransition.count()).toBe(3);
    expect(await db.paymentEvent.count()).toBe(1);
  });
});
