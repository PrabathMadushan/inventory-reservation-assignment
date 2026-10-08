import type { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { JwtService } from '@nestjs/jwt';
import request from 'supertest';
import type { App } from 'supertest/types';
import { AppModule } from '../src/app.module';
import { configureApp } from '../src/configure-app';
import { PrismaService } from '../src/prisma/prisma.service';
import { OrderTransitionsService } from '../src/orders/order-transitions.service';
import { demoProducts } from '../prisma/seed-data';
import type { serializeOrder } from '../src/orders/order.serializer';

type Order = ReturnType<typeof serializeOrder>;
type Page = { items: Order[]; page: number; pageSize: number; total: number };
function deferred() {
  let resolve!: () => void;
  const promise = new Promise<void>((done) => {
    resolve = done;
  });
  return { promise, resolve };
}

describe('Orders (two independent NestJS pools, real PostgreSQL)', () => {
  let first: INestApplication<App>;
  let second: INestApplication<App>;
  let prisma: PrismaService;
  let alice: string;
  let bob: string;
  let ops: string;

  async function resetFixtures() {
    await prisma.$transaction(async (tx) => {
      await tx.$executeRaw`TRUNCATE TABLE payment_events, order_transitions, order_idempotency, orders`;
      for (const product of demoProducts)
        await tx.product.update({ where: { id: product.id }, data: product });
    });
  }
  beforeAll(async () => {
    async function start() {
      const module = await Test.createTestingModule({
        imports: [AppModule],
      }).compile();
      const app: INestApplication<App> = module.createNestApplication();
      configureApp(app);
      await app.init();
      return app;
    }
    first = await start();
    second = await start();
    prisma = first.get(PrismaService);
    expect(second.get(PrismaService)).not.toBe(prisma);
    const jwt = first.get(JwtService);
    [alice, bob, ops] = await Promise.all(
      ['user-alice', 'user-bob', 'user-ops'].map((sub) =>
        jwt.signAsync({ sub }),
      ),
    );
  }, 30000);
  beforeEach(resetFixtures);
  afterEach(() => jest.restoreAllMocks());
  afterAll(async () => {
    if (prisma) await resetFixtures();
    await second?.close();
    await first?.close();
  });

  function create(
    app = first,
    token = alice,
    key = 'attempt-1',
    quantity = 1,
    productId = 'product-keyboard',
  ) {
    return request(app.getHttpServer())
      .post('/api/orders')
      .auth(token, { type: 'bearer' })
      .set('Idempotency-Key', key)
      .send({ productId, quantity });
  }
  function get(path: string, token = alice) {
    return request(first.getHttpServer())
      .get(`/api/orders${path}`)
      .auth(token, { type: 'bearer' });
  }
  async function assertState(
    stock: bigint,
    count: number,
    productId = 'product-keyboard',
  ) {
    expect(
      (await prisma.product.findUniqueOrThrow({ where: { id: productId } }))
        .availableQuantity,
    ).toBe(stock);
    expect(await prisma.order.count()).toBe(count);
    expect(await prisma.orderTransition.count()).toBe(count);
    expect(await prisma.orderIdempotency.count()).toBe(count);
    expect(
      await prisma.orderIdempotency.count({ where: { orderId: null } }),
    ).toBe(0);
  }

  it('returns exact snapshots, history, numeric money, and an identical 200 retry', async () => {
    const response = await create(first, alice, 'once', 2).expect(201);
    const order = response.body as Order;
    expect(Object.keys(order).sort()).toEqual(
      [
        'id',
        'customerId',
        'productId',
        'productName',
        'quantity',
        'unitPriceMinor',
        'totalMinor',
        'currency',
        'status',
        'createdAt',
        'updatedAt',
        'history',
      ].sort(),
    );
    expect(order).toMatchObject({
      customerId: 'user-alice',
      productId: 'product-keyboard',
      productName: 'Mechanical Keyboard',
      quantity: 2,
      unitPriceMinor: 1500000,
      totalMinor: 3000000,
      currency: 'LKR',
      status: 'PENDING',
    });
    expect(order.history).toHaveLength(1);
    expect(order.history[0].occurredAt).toMatch(/Z$/);
    expect(order.history).toEqual([
      {
        fromStatus: null,
        toStatus: 'PENDING',
        reason: 'ORDER_CREATED',
        occurredAt: order.history[0].occurredAt,
      },
    ]);
    expect(order.createdAt).toMatch(/Z$/);
    expect(order.updatedAt).toMatch(/Z$/);
    expect((await create(first, alice, 'once', 2).expect(200)).body).toEqual(
      order,
    );
    expect((await get(`/${order.id}`).expect(200)).body).toEqual(order);
    await assertState(18n, 1);
    await prisma.product.update({
      where: { id: order.productId },
      data: { name: 'Changed', unitPriceMinor: 100n },
    });
    expect((await get(`/${order.id}`).expect(200)).body).toEqual(order);
    expect((await create(first, alice, 'once', 2).expect(200)).body).toEqual(
      order,
    );
  });

  it.each([0, -1, 1.5, '1', true, null, Number.MAX_SAFE_INTEGER + 1])(
    'rejects invalid quantity %p without any writes',
    async (quantity: unknown) => {
      await request(first.getHttpServer())
        .post('/api/orders')
        .auth(alice, { type: 'bearer' })
        .set('Idempotency-Key', 'invalid')
        .send({ productId: 'product-keyboard', quantity })
        .expect(400);
      await assertState(20n, 0);
    },
  );
  it.each([
    { productId: 'product-keyboard' },
    { productId: ' ', quantity: 1 },
    { quantity: 1 },
    { productId: 'product-keyboard', quantity: 1, customerId: 'user-bob' },
    { productId: 'product-keyboard', quantity: 1, unitPriceMinor: 1 },
    { productId: 'product-keyboard', quantity: 1, status: 'CONFIRMED' },
  ])('rejects malformed or extra request fields %p', async (body) => {
    await request(first.getHttpServer())
      .post('/api/orders')
      .auth(alice, { type: 'bearer' })
      .set('Idempotency-Key', 'invalid')
      .send(body)
      .expect(400);
    await assertState(20n, 0);
  });
  it.each([undefined, ''])('requires a nonempty retry key %p', async (key) => {
    const call = request(first.getHttpServer())
      .post('/api/orders')
      .auth(alice, { type: 'bearer' });
    if (key !== undefined) call.set('Idempotency-Key', key);
    await call.send({ productId: 'product-keyboard', quantity: 1 }).expect(400);
    await assertState(20n, 0);
  });
  it('rolls back failed keys so missing products and insufficient stock can be retried', async () => {
    await create(first, alice, 'retry', 1, 'unknown-product').expect(404);
    await assertState(20n, 0);
    const failed = await create(first, alice, 'retry', 21).expect(409);
    expect(failed.body as unknown).toMatchObject({
      code: 'INSUFFICIENT_STOCK',
    });
    await assertState(20n, 0);
    await create(first, alice, 'retry', 1).expect(201);
    await assertState(19n, 1);
  });
  it('rejects changed canonical input and scopes keys to the customer', async () => {
    await create(first, alice, 'shared').expect(201);
    for (const [quantity, productId] of [
      [2, 'product-keyboard'],
      [1, 'product-hub'],
    ] as const) {
      const conflict = await create(
        first,
        alice,
        'shared',
        quantity,
        productId,
      ).expect(409);
      expect(conflict.body as unknown).toMatchObject({
        code: 'IDEMPOTENCY_CONFLICT',
      });
    }
    await assertState(19n, 1);
    await create(second, bob, 'shared').expect(201);
    await assertState(18n, 2);
  });
  it('enforces auth, customer roles and ownership on every route', async () => {
    const order = (await create().expect(201)).body as Order;
    for (const path of ['', `/${order.id}`]) {
      await request(first.getHttpServer())
        .get(`/api/orders${path}`)
        .expect(401);
      await get(path, ops).expect(403);
    }
    await request(first.getHttpServer())
      .post('/api/orders')
      .send({ productId: order.productId, quantity: 1 })
      .expect(401);
    await create(first, ops).expect(403);
    await get(`/${order.id}`, bob).expect(404);
    await get('/unknown', alice).expect(404);
    expect((await get('', bob).expect(200)).body as Page).toEqual({
      items: [],
      page: 1,
      pageSize: 10,
      total: 0,
    });
    await assertState(19n, 1);
  });
  it.each([
    'page=0',
    'page=-1',
    'page=1.5',
    'page=true',
    'page=1e2',
    'page=9007199254740992',
    'pageSize=101',
    'pageSize=0',
    'status=pending',
    'status=UNKNOWN',
    'page=1&page=2',
    'customerId=user-bob',
  ])('validates query %s', async (query) => {
    await get(`?${query}`).expect(400);
  });
  it('paginates and filters with stable timestamp ties, matching counts and ownership', async () => {
    const a = (await create(first, alice, 'a').expect(201)).body as Order;
    const b = (await create(first, alice, 'b').expect(201)).body as Order;
    await create(first, bob, 'c').expect(201);
    await prisma.order.updateMany({
      data: { createdAt: new Date('2026-01-01T00:00:00Z') },
    });
    // Read fixture only; terminal business actions are implemented in Phase 5.
    await prisma.$transaction(async (tx) => {
      await tx.order.update({
        where: { id: a.id },
        data: { status: 'CONFIRMED' },
      });
      await tx.orderTransition.create({
        data: {
          orderId: a.id,
          sequence: 1,
          fromStatus: 'PENDING',
          toStatus: 'CONFIRMED',
          reason: 'PAYMENT_SUCCEEDED',
        },
      });
    });
    const sorted = [a.id, b.id].sort().reverse();
    const one = (await get('?pageSize=1').expect(200)).body as Page;
    const two = (await get('?page=2&pageSize=1').expect(200)).body as Page;
    expect([one.items[0].id, two.items[0].id]).toEqual(sorted);
    expect(one.total).toBe(2);
    expect(two.total).toBe(2);
    expect(
      (await get('?status=PENDING').expect(200)).body as Page,
    ).toMatchObject({ total: 1, items: [{ id: b.id }] });
    const confirmed = (await get('?status=CONFIRMED').expect(200)).body as Page;
    expect(confirmed.total).toBe(1);
    expect(confirmed.items[0].history.map((entry) => entry.toStatus)).toEqual([
      'PENDING',
      'CONFIRMED',
    ]);
    expect(
      (await get('?page=9007199254740991&pageSize=100').expect(200))
        .body as Page,
    ).toEqual({
      items: [],
      total: 2,
      page: Number.MAX_SAFE_INTEGER,
      pageSize: 100,
    });
  });
  it('rolls back a server-total overflow after reservation', async () => {
    await prisma.product.update({
      where: { id: 'product-keyboard' },
      data: { availableQuantity: BigInt(Number.MAX_SAFE_INTEGER) },
    });
    await create(first, alice, 'overflow', Number.MAX_SAFE_INTEGER).expect(400);
    await assertState(BigInt(Number.MAX_SAFE_INTEGER), 0);
  });
  it('rolls back stock, order, history and key when a later write fails', async () => {
    const service = first.get(OrderTransitionsService);
    const original = service.recordCreation.bind(service);
    const spy = jest
      .spyOn(service, 'recordCreation')
      .mockImplementation(async (tx, id) => {
        await original(tx, id);
        throw new Error('Test-only failure after stock/order/history writes');
      });
    await create().expect(500);
    await assertState(20n, 0);
    spy.mockRestore();
    await create().expect(201);
    await assertState(19n, 1);
  });

  async function waitForDatabaseLock(fragment: string) {
    const until = Date.now() + 3000;
    while (Date.now() < until) {
      const rows = await prisma.$queryRaw<Array<{ waiting: boolean }>>`
        SELECT EXISTS (SELECT 1 FROM pg_stat_activity
          WHERE datname = current_database() AND wait_event_type = 'Lock'
          AND query LIKE ${`%${fragment}%`}) AS waiting`;
      if (rows[0].waiting) return;
      await new Promise((resolve) => setTimeout(resolve, 20));
    }
    throw new Error(`No PostgreSQL lock observed for ${fragment}`);
  }
  it.each([
    'last-unit',
    'same-key',
    'changed-input',
    'winner-rolls-back',
  ] as const)(
    'uses database locks across independent apps: %s',
    async (scenario) => {
      const entered = deferred();
      const release = deferred();
      const service = first.get(OrderTransitionsService);
      const original = service.recordCreation.bind(service);
      jest
        .spyOn(service, 'recordCreation')
        .mockImplementation(async (tx, id) => {
          await original(tx, id);
          entered.resolve();
          await release.promise;
          if (scenario === 'winner-rolls-back')
            throw new Error('Test-only losing transaction');
        });
      const lastUnit = scenario === 'last-unit';
      const productId = lastUnit ? 'product-headphones' : 'product-keyboard';
      const a = create(first, alice, 'race', 1, productId).then(
        (response) => response,
      );
      let b: Promise<request.Response> | undefined;
      try {
        await Promise.race([
          entered.promise,
          new Promise<never>((_, reject) => {
            const timer = setTimeout(
              () => reject(new Error('Reservation never entered barrier')),
              4000,
            );
            timer.unref();
          }),
        ]);
        b = create(
          second,
          lastUnit ? bob : alice,
          lastUnit ? 'other-key' : 'race',
          scenario === 'changed-input' ? 2 : 1,
          productId,
        ).then((response) => response);
        await waitForDatabaseLock(
          lastUnit ? 'UPDATE products' : 'INSERT INTO order_idempotency',
        );
      } finally {
        release.resolve();
        await Promise.allSettled([a, ...(b ? [b] : [])]);
      }
      const winner = await a;
      const contender = await b;
      if (!contender) throw new Error('Contending request did not start');
      expect(winner.status).toBe(scenario === 'winner-rolls-back' ? 500 : 201);
      expect(contender.status).toBe(
        lastUnit || scenario === 'changed-input'
          ? 409
          : scenario === 'winner-rolls-back'
            ? 201
            : 200,
      );
      if (lastUnit || scenario === 'changed-input')
        expect(contender.body as unknown).toMatchObject({
          code: lastUnit ? 'INSUFFICIENT_STOCK' : 'IDEMPOTENCY_CONFLICT',
        });
      if (scenario === 'same-key')
        expect(contender.body as Order).toEqual(winner.body as Order);
      await assertState(lastUnit ? 0n : 19n, 1, productId);
    },
    15000,
  );
});
