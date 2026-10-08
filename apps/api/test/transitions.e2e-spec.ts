import type { INestApplication } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import type { App } from 'supertest/types';
import { AppModule } from '../src/app.module';
import { configureApp } from '../src/configure-app';
import { PrismaService } from '../src/prisma/prisma.service';
import { OrderTransitionsService } from '../src/orders/order-transitions.service';
import { demoProducts } from '../prisma/seed-data';
import type { serializeOrder } from '../src/orders/order.serializer';

type Order = ReturnType<typeof serializeOrder>;
type EventResult = {
  eventId: string;
  orderId: string;
  outcome: 'APPLIED' | 'IGNORED' | 'DUPLICATE';
  orderStatus: Order['status'];
};
type EventType = 'PAYMENT_SUCCEEDED' | 'PAYMENT_FAILED';
function assertPublicOrder(order: Order) {
  expect(Object.keys(order).sort()).toEqual(
    [
      'createdAt',
      'currency',
      'customerId',
      'history',
      'id',
      'productId',
      'productName',
      'quantity',
      'status',
      'totalMinor',
      'unitPriceMinor',
      'updatedAt',
    ].sort(),
  );
  for (const value of [
    order.quantity,
    order.unitPriceMinor,
    order.totalMinor,
  ]) {
    expect(typeof value).toBe('number');
    expect(Number.isSafeInteger(value)).toBe(true);
  }
  expect(order.totalMinor).toBe(order.quantity * order.unitPriceMinor);
  expect(order.currency).toBe('LKR');
  for (const stamp of [
    order.createdAt,
    order.updatedAt,
    ...order.history.map((x) => x.occurredAt),
  ]) {
    expect(stamp).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/);
    expect(new Date(stamp).toISOString()).toBe(stamp);
  }
  for (const entry of order.history) {
    expect(Object.keys(entry).sort()).toEqual([
      'fromStatus',
      'occurredAt',
      'reason',
      'toStatus',
    ]);
  }
  expect(order.history[0]).toMatchObject({
    fromStatus: null,
    toStatus: 'PENDING',
    reason: 'ORDER_CREATED',
  });
  expect(order.history.at(-1)?.toStatus).toBe(order.status);
  if (order.status !== 'PENDING')
    expect(order.history.at(-1)?.occurredAt).toBe(order.updatedAt);
}
function deferred() {
  let resolve!: () => void;
  const promise = new Promise<void>((done) => {
    resolve = done;
  });
  return { promise, resolve };
}

describe('Payment/cancellation transactions (real PostgreSQL, independent apps)', () => {
  let a: INestApplication<App>;
  let b: INestApplication<App>;
  let db: PrismaService;
  let alice: string;
  let bob: string;
  let ops: string;
  let secret: string;
  async function start() {
    const module = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();
    const app: INestApplication<App> = module.createNestApplication();
    configureApp(app);
    await app.init();
    return app;
  }
  async function reset() {
    await db.$transaction(async (tx) => {
      await tx.$executeRaw`TRUNCATE TABLE payment_events, order_transitions, order_idempotency, orders`;
      for (const product of demoProducts)
        await tx.product.update({ where: { id: product.id }, data: product });
    });
  }
  beforeAll(async () => {
    a = await start();
    b = await start();
    db = a.get(PrismaService);
    expect(db).not.toBe(b.get(PrismaService));
    [alice, bob, ops] = await Promise.all(
      ['user-alice', 'user-bob', 'user-ops'].map((sub) =>
        a.get(JwtService).signAsync({ sub }),
      ),
    );
    secret = a.get(ConfigService).getOrThrow<string>('WEBHOOK_SECRET');
  }, 30000);
  beforeEach(reset);
  afterEach(() => jest.restoreAllMocks());
  afterAll(async () => {
    if (db) await reset();
    await b?.close();
    await a?.close();
  });
  async function create(key = 'order', quantity = 2) {
    const response = await request(a.getHttpServer())
      .post('/api/orders')
      .auth(alice, { type: 'bearer' })
      .set('Idempotency-Key', key)
      .send({ productId: 'product-keyboard', quantity })
      .expect(201);
    return response.body as Order;
  }
  function payment(
    id: string,
    type: EventType = 'PAYMENT_FAILED',
    eventId = 'event',
    app = a,
  ) {
    return request(app.getHttpServer())
      .post('/api/webhooks/payments')
      .set('X-Webhook-Secret', secret)
      .send({ eventId, orderId: id, type });
  }
  function cancel(id: string, app = a, token = alice) {
    return request(app.getHttpServer())
      .post(`/api/orders/${id}/cancel`)
      .auth(token, { type: 'bearer' })
      .send({});
  }
  async function assertOrder(
    id: string,
    status: Order['status'],
    stock: bigint,
    events: number,
  ) {
    const order = await db.order.findUniqueOrThrow({
      where: { id },
      include: { history: { orderBy: { sequence: 'asc' } } },
    });
    expect(order.status).toBe(status);
    expect(order.history.map((x) => x.toStatus)).toEqual(['PENDING', status]);
    expect(order.history[1].occurredAt).toEqual(order.updatedAt);
    expect(
      (
        await db.product.findUniqueOrThrow({
          where: { id: 'product-keyboard' },
        })
      ).availableQuantity,
    ).toBe(stock);
    expect(await db.paymentEvent.count()).toBe(events);
    expect(await db.paymentEvent.count({ where: { outcome: null } })).toBe(0);
  }
  it.each(['PAYMENT_SUCCEEDED', 'PAYMENT_FAILED'] as const)(
    'applies %s once, persists duplicates/ignored events and rejects terminal cancellation',
    async (type) => {
      const order = await create();
      const status = type === 'PAYMENT_SUCCEEDED' ? 'CONFIRMED' : 'FAILED';
      const result = (await payment(order.id, type).expect(200))
        .body as EventResult;
      expect(result).toEqual({
        eventId: 'event',
        orderId: order.id,
        outcome: 'APPLIED',
        orderStatus: status,
      });
      expect(
        (await payment(order.id, type).expect(200)).body as EventResult,
      ).toEqual({ ...result, outcome: 'DUPLICATE' });
      const opposite =
        type === 'PAYMENT_SUCCEEDED' ? 'PAYMENT_FAILED' : 'PAYMENT_SUCCEEDED';
      expect(
        (await payment(order.id, opposite, 'later').expect(200))
          .body as EventResult,
      ).toEqual({ ...result, eventId: 'later', outcome: 'IGNORED' });
      expect(
        (await payment(order.id, opposite, 'later').expect(200))
          .body as EventResult,
      ).toEqual({ ...result, eventId: 'later', outcome: 'DUPLICATE' });
      expect(
        (await cancel(order.id).expect(409)).body as unknown,
      ).toMatchObject({ code: 'INVALID_TRANSITION' });
      await assertOrder(
        order.id,
        status,
        status === 'CONFIRMED' ? 18n : 20n,
        2,
      );
      expect(
        (
          await db.orderTransition.findUniqueOrThrow({
            where: { orderId_sequence: { orderId: order.id, sequence: 1 } },
          })
        ).reason,
      ).toBe(type);
    },
  );
  it('cancels pending orders once, returns full history and ignores later callbacks', async () => {
    const order = await create();
    const cancelled = (await cancel(order.id).expect(200)).body as Order;
    expect(cancelled).toMatchObject({
      id: order.id,
      status: 'CANCELLED',
      totalMinor: 3000000,
    });
    expect(cancelled.history.map((x) => x.reason)).toEqual([
      'ORDER_CREATED',
      'CUSTOMER_CANCELLED',
    ]);
    await cancel(order.id).expect(409);
    expect(
      (await payment(order.id).expect(200)).body as EventResult,
    ).toMatchObject({ outcome: 'IGNORED', orderStatus: 'CANCELLED' });
    expect(
      (await payment(order.id).expect(200)).body as EventResult,
    ).toMatchObject({ outcome: 'DUPLICATE', orderStatus: 'CANCELLED' });
    await assertOrder(order.id, 'CANCELLED', 20n, 1);
  });
  it.each([undefined, '', 'wrong-secret'])(
    'rejects webhook credentials %p without consuming event IDs',
    async (value) => {
      const order = await create();
      const call = request(a.getHttpServer()).post('/api/webhooks/payments');
      if (value !== undefined) call.set('X-Webhook-Secret', value);
      await call
        .send({ eventId: 'event', orderId: order.id, type: 'PAYMENT_FAILED' })
        .expect(401);
      expect(await db.paymentEvent.count()).toBe(0);
      expect(
        (await db.order.findUniqueOrThrow({ where: { id: order.id } })).status,
      ).toBe('PENDING');
      await payment(order.id).expect(200);
    },
  );
  it.each([
    { eventId: ' ', orderId: 'some-order', type: 'PAYMENT_FAILED' },
    { eventId: 2, orderId: 'some-order', type: 'PAYMENT_FAILED' },
    { eventId: 'event', orderId: '', type: 'PAYMENT_FAILED' },
    { eventId: 'event', type: 'PAYMENT_FAILED' },
    { eventId: 'event', orderId: 'some-order', type: 'payment_failed' },
    {
      eventId: 'event',
      orderId: 'some-order',
      type: 'PAYMENT_FAILED',
      outcome: 'APPLIED',
    },
  ])('validates webhook body %p', async (body) => {
    await request(a.getHttpServer())
      .post('/api/webhooks/payments')
      .set('X-Webhook-Secret', secret)
      .send(body)
      .expect(400);
    expect(await db.paymentEvent.count()).toBe(0);
  });
  it('does not accept unknown orders and prioritizes existing event conflicts before changed-order lookup', async () => {
    await payment('unknown').expect(404);
    expect(await db.paymentEvent.count()).toBe(0);
    const order = await create();
    await payment(order.id).expect(200);
    expect(
      (await payment('unknown').expect(409)).body as unknown,
    ).toMatchObject({ code: 'EVENT_ID_CONFLICT' });
    expect(
      (await payment(order.id, 'PAYMENT_SUCCEEDED').expect(409))
        .body as unknown,
    ).toMatchObject({ code: 'EVENT_ID_CONFLICT' });
    await assertOrder(order.id, 'FAILED', 20n, 1);
  });
  it('enforces cancellation auth, role, ownership and empty body', async () => {
    const order = await create();
    await request(a.getHttpServer())
      .post(`/api/orders/${order.id}/cancel`)
      .send({})
      .expect(401);
    await cancel(order.id, a, bob).expect(404);
    await cancel('unknown').expect(404);
    await cancel(order.id, a, ops).expect(403);
    for (const body of [{ status: 'CANCELLED' }, [], [1]]) {
      await request(a.getHttpServer())
        .post(`/api/orders/${order.id}/cancel`)
        .auth(alice, { type: 'bearer' })
        .send(body)
        .expect(400);
    }
    expect(
      (await db.order.findUniqueOrThrow({ where: { id: order.id } })).status,
    ).toBe('PENDING');
    expect(await db.orderTransition.count()).toBe(1);
    await request(a.getHttpServer())
      .post(`/api/orders/${order.id}/cancel`)
      .auth(alice, { type: 'bearer' })
      .expect(200);
    await assertOrder(order.id, 'CANCELLED', 20n, 0);
  });
  it.each(['payment', 'cancel'] as const)(
    'rolls back %s after terminal state/stock/history writes fail',
    async (action) => {
      const order = await create();
      const service = a.get(OrderTransitionsService);
      const original = service.apply.bind(service);
      const spy = jest
        .spyOn(service, 'apply')
        .mockImplementation(async (...args) => {
          await original(...args);
          throw new Error('Test-only terminal failure');
        });
      await (
        action === 'payment' ? payment(order.id) : cancel(order.id)
      ).expect(500);
      expect(
        (await db.order.findUniqueOrThrow({ where: { id: order.id } })).status,
      ).toBe('PENDING');
      expect(
        (
          await db.product.findUniqueOrThrow({
            where: { id: 'product-keyboard' },
          })
        ).availableQuantity,
      ).toBe(18n);
      expect(await db.orderTransition.count()).toBe(1);
      expect(await db.paymentEvent.count()).toBe(0);
      spy.mockRestore();
      await (
        action === 'payment' ? payment(order.id) : cancel(order.id)
      ).expect(200);
      await assertOrder(
        order.id,
        action === 'payment' ? 'FAILED' : 'CANCELLED',
        20n,
        action === 'payment' ? 1 : 0,
      );
    },
  );

  async function waitLock(fragment: string, minimum = 1) {
    const deadline = Date.now() + 3000;
    while (Date.now() < deadline) {
      const rows = await db.$queryRaw<
        Array<{ waiting: number }>
      >`SELECT count(*)::int AS waiting FROM pg_stat_activity WHERE datname=current_database() AND wait_event_type='Lock' AND query LIKE ${`%${fragment}%`}`;
      if (rows[0].waiting >= minimum) return;
      await new Promise((resolve) => setTimeout(resolve, 20));
    }
    throw new Error('Expected PostgreSQL lock was not observed');
  }
  it.each([
    ['cancel', 'PAYMENT_SUCCEEDED'],
    ['payment', 'PAYMENT_SUCCEEDED'],
    ['cancel', 'PAYMENT_FAILED'],
    ['payment', 'PAYMENT_FAILED'],
    ['double-cancel', 'PAYMENT_FAILED'],
    ['same-event', 'PAYMENT_FAILED'],
    ['changed-event', 'PAYMENT_FAILED'],
    ['different-events', 'PAYMENT_FAILED'],
    ['rollback-first', 'PAYMENT_FAILED'],
  ] as const)(
    'controlled independent-app race: %s / %s',
    async (scenario, type) => {
      const order = await create();
      const entered = deferred();
      const release = deferred();
      const service = a.get(OrderTransitionsService);
      const original = service.apply.bind(service);
      jest.spyOn(service, 'apply').mockImplementation(async (...args) => {
        const result = await original(...args);
        entered.resolve();
        await release.promise;
        if (scenario === 'rollback-first')
          throw new Error('Test-only rollback');
        return result;
      });
      const cancellationFirst =
        scenario === 'cancel' || scenario === 'double-cancel';
      const first = (
        cancellationFirst ? cancel(order.id) : payment(order.id, type)
      ).then((response) => response);
      let second: Promise<request.Response> | undefined;
      try {
        await Promise.race([
          entered.promise,
          new Promise<never>((_, reject) => {
            const timer = setTimeout(
              () => reject(new Error('Barrier not reached')),
              4000,
            );
            timer.unref();
          }),
        ]);
        second = (
          scenario === 'double-cancel' || scenario === 'payment'
            ? cancel(order.id, b)
            : payment(
                order.id,
                scenario === 'changed-event' ? 'PAYMENT_SUCCEEDED' : type,
                scenario === 'cancel' || scenario === 'different-events'
                  ? 'other-event'
                  : 'event',
                b,
              )
        ).then((response) => response);
        await waitLock(
          scenario === 'same-event' ||
            scenario === 'changed-event' ||
            scenario === 'rollback-first'
            ? 'INSERT INTO payment_events'
            : 'FOR UPDATE',
        );
      } finally {
        release.resolve();
        await Promise.allSettled([first, ...(second ? [second] : [])]);
      }
      const one = await first;
      const two = await second;
      if (!two) throw new Error('No contender');
      expect(one.status).toBe(scenario === 'rollback-first' ? 500 : 200);
      expect(two.status).toBe(
        scenario === 'payment' ||
          scenario === 'double-cancel' ||
          scenario === 'changed-event'
          ? 409
          : 200,
      );
      const status = cancellationFirst
        ? 'CANCELLED'
        : type === 'PAYMENT_SUCCEEDED'
          ? 'CONFIRMED'
          : 'FAILED';
      const eventCount =
        scenario === 'double-cancel'
          ? 0
          : scenario === 'different-events'
            ? 2
            : 1;
      await assertOrder(
        order.id,
        status,
        status === 'CONFIRMED' ? 18n : 20n,
        eventCount,
      );
      if (scenario === 'same-event')
        expect(two.body as EventResult).toMatchObject({
          outcome: 'DUPLICATE',
          orderStatus: status,
        });
      if (scenario === 'cancel' || scenario === 'different-events')
        expect(two.body as EventResult).toMatchObject({
          outcome: 'IGNORED',
          orderStatus: status,
        });
      if (scenario === 'changed-event')
        expect(two.body as unknown).toMatchObject({
          code: 'EVENT_ID_CONFLICT',
        });
      if (scenario === 'rollback-first')
        expect(two.body as EventResult).toMatchObject({
          outcome: 'APPLIED',
          orderStatus: 'FAILED',
        });
    },
    15000,
  );
  it.each(['CANCELLED', 'CONFIRMED', 'FAILED'] as const)(
    'creation retry waits for committing %s and returns consistent history',
    async (status) => {
      const order = await create('retry-during-transition');
      const entered = deferred();
      const release = deferred();
      const service = a.get(OrderTransitionsService);
      const original = service.apply.bind(service);
      jest.spyOn(service, 'apply').mockImplementation(async (...args) => {
        const result = await original(...args);
        entered.resolve();
        await release.promise;
        return result;
      });
      const transition = (
        status === 'CANCELLED'
          ? cancel(order.id)
          : payment(
              order.id,
              status === 'CONFIRMED' ? 'PAYMENT_SUCCEEDED' : 'PAYMENT_FAILED',
            )
      ).then((response) => response);
      let retry: Promise<request.Response> | undefined;
      try {
        await Promise.race([
          entered.promise,
          new Promise<never>((_, reject) => {
            const timer = setTimeout(
              () => reject(new Error('Transition barrier not reached')),
              4000,
            );
            timer.unref();
          }),
        ]);
        retry = request(b.getHttpServer())
          .post('/api/orders')
          .auth(alice, { type: 'bearer' })
          .set('Idempotency-Key', 'retry-during-transition')
          .send({ productId: 'product-keyboard', quantity: 2 })
          .then((response) => response);
        await waitLock('FOR SHARE');
      } finally {
        release.resolve();
        await Promise.allSettled([transition, ...(retry ? [retry] : [])]);
      }
      expect((await transition).status).toBe(200);
      const response = await retry;
      if (!response) throw new Error('Retry did not start');
      expect(response.status).toBe(200);
      const replay = response.body as Order;
      expect(replay).toMatchObject({ id: order.id, status });
      assertPublicOrder(replay);
      expect(replay.history).toHaveLength(2);
      await assertOrder(
        order.id,
        status,
        status === 'CONFIRMED' ? 18n : 20n,
        status === 'CANCELLED' ? 0 : 1,
      );
      expect(await db.order.count()).toBe(1);
      expect(await db.orderIdempotency.count()).toBe(1);
      expect(
        await db.orderIdempotency.count({ where: { orderId: null } }),
      ).toBe(0);
    },
    15000,
  );

  it.each(['CANCELLED', 'CONFIRMED', 'FAILED'] as const)(
    'preserves the exact public Order contract across all response paths after %s',
    async (status) => {
      const order = await create('public-contract');
      assertPublicOrder(order);
      if (status === 'CANCELLED')
        assertPublicOrder((await cancel(order.id).expect(200)).body as Order);
      else
        await payment(
          order.id,
          status === 'CONFIRMED' ? 'PAYMENT_SUCCEEDED' : 'PAYMENT_FAILED',
        ).expect(200);
      const replay = await request(b.getHttpServer())
        .post('/api/orders')
        .auth(alice, { type: 'bearer' })
        .set('Idempotency-Key', 'public-contract')
        .send({ productId: 'product-keyboard', quantity: 2 })
        .expect(200);
      assertPublicOrder(replay.body as Order);
      for (const [prefix, token] of [
        ['/api/orders', alice],
        ['/api/operations/orders', ops],
      ]) {
        const detail = await request(b.getHttpServer())
          .get(`${prefix}/${order.id}`)
          .auth(token, { type: 'bearer' })
          .expect(200);
        assertPublicOrder(detail.body as Order);
        expect(detail.body as Order).toEqual(replay.body as Order);
        const list = await request(b.getHttpServer())
          .get(prefix)
          .auth(token, { type: 'bearer' })
          .expect(200);
        const page = list.body as {
          items: Order[];
          page: number;
          pageSize: number;
          total: number;
        };
        expect(Object.keys(page).sort()).toEqual([
          'items',
          'page',
          'pageSize',
          'total',
        ]);
        expect(page.total).toBe(1);
        expect(page.items).toHaveLength(1);
        assertPublicOrder(page.items[0]);
        expect(page.items[0]).toEqual(replay.body as Order);
      }
      await assertOrder(
        order.id,
        status,
        status === 'CONFIRMED' ? 18n : 20n,
        status === 'CANCELLED' ? 0 : 1,
      );
    },
  );
  it('atomic increments preserve concurrent releases for different orders of the same product', async () => {
    const one = await create('one', 2);
    const two = await create('two', 3);
    const entered = deferred();
    const release = deferred();
    const blocker = db.$transaction(
      async (tx) => {
        await tx.$queryRaw`SELECT id FROM products WHERE id = 'product-keyboard' FOR UPDATE`;
        entered.resolve();
        await release.promise;
      },
      { timeout: 10000 },
    );
    await entered.promise;
    const first = payment(one.id, 'PAYMENT_FAILED', 'one', a).then(
      (response) => response,
    );
    const second = payment(two.id, 'PAYMENT_FAILED', 'two', b).then(
      (response) => response,
    );
    try {
      await waitLock('UPDATE products', 2);
    } finally {
      release.resolve();
      await Promise.allSettled([blocker, first, second]);
    }
    const responses = await Promise.all([first, second]);
    expect(responses.map((x) => x.status)).toEqual([200, 200]);
    await assertOrder(one.id, 'FAILED', 20n, 2);
    await assertOrder(two.id, 'FAILED', 20n, 2);
    expect(await db.orderTransition.count()).toBe(4);
  });
  it('keeps deferred event/order referential integrity authoritative at commit', async () => {
    const constraints = await db.$queryRaw<
      Array<{ condeferrable: boolean; condeferred: boolean }>
    >`
      SELECT condeferrable, condeferred FROM pg_constraint WHERE conname = 'payment_events_order_id_fkey'`;
    expect(constraints).toEqual([{ condeferrable: true, condeferred: true }]);
    await expect(
      db.$transaction(async (tx) => {
        await tx.$executeRaw`INSERT INTO payment_events (event_id,order_id,type) VALUES ('invalid-fk','missing-order','PAYMENT_FAILED')`;
      }),
    ).rejects.toThrow();
    expect(await db.paymentEvent.count()).toBe(0);
  });
  it('preserves orders, retry keys and accepted event payloads across application restart', async () => {
    const order = await create('restart', 2);
    await payment(order.id).expect(200);
    await b.close();
    await a.close();
    a = await start();
    b = await start();
    db = a.get(PrismaService);
    const replay = await request(b.getHttpServer())
      .post('/api/orders')
      .auth(alice, { type: 'bearer' })
      .set('Idempotency-Key', 'restart')
      .send({ productId: 'product-keyboard', quantity: 2 })
      .expect(200);
    expect(replay.body as Order).toMatchObject({
      id: order.id,
      status: 'FAILED',
    });
    expect(
      (await payment(order.id).expect(200)).body as EventResult,
    ).toMatchObject({ outcome: 'DUPLICATE', orderStatus: 'FAILED' });
    await cancel(order.id).expect(409);
    await assertOrder(order.id, 'FAILED', 20n, 1);
  }, 30000);
});
