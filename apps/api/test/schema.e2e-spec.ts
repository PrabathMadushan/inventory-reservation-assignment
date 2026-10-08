import { ConfigService } from '@nestjs/config';
import { Prisma } from '@prisma/client';
import { compare } from 'bcrypt';
import { demoProducts, demoUsers, seedDatabase } from '../prisma/seed-data';
import { PrismaService } from '../src/prisma/prisma.service';

describe('Assignment schema (real PostgreSQL)', () => {
  const prisma = new PrismaService(
    new ConfigService({ DATABASE_URL: process.env.DATABASE_URL }),
  );

  beforeAll(() => prisma.$connect(), 30000);
  afterAll(() => prisma.$disconnect());

  async function assertSeed(): Promise<void> {
    const users = await prisma.user.findMany({ orderBy: { id: 'asc' } });
    expect(users.map(({ id, email, role }) => ({ id, email, role }))).toEqual(
      demoUsers,
    );
    for (const user of users) {
      expect(user.passwordHash).not.toBe('DemoPass123!');
      expect(await compare('DemoPass123!', user.passwordHash)).toBe(true);
    }
    expect(await prisma.product.findMany({ orderBy: { id: 'asc' } })).toEqual(
      demoProducts
        .map((product) => ({ ...product, currency: 'LKR' }))
        .sort((a, b) => a.id.localeCompare(b.id)),
    );
    expect(await prisma.order.count()).toBe(0);
    expect(await prisma.orderIdempotency.count()).toBe(0);
    expect(await prisma.orderTransition.count()).toBe(0);
    expect(await prisma.paymentEvent.count()).toBe(0);
  }

  async function fixture(tx: Prisma.TransactionClient): Promise<void> {
    await tx.order.create({
      data: {
        id: 'fixture-order',
        customerId: 'user-alice',
        productId: 'product-keyboard',
        productName: 'Mechanical Keyboard',
        quantity: 1n,
        unitPriceMinor: 1500000n,
        totalMinor: 1500000n,
      },
    });
  }

  // Always roll back, even if an invalid write unexpectedly succeeds.
  function rolledTransaction(
    work: (tx: Prisma.TransactionClient) => Promise<void>,
  ): Promise<never> {
    return prisma.$transaction(async (tx) => {
      await fixture(tx);
      await work(tx);
      throw new Error('fixture rollback');
    });
  }

  async function rejectsSql(
    work: (tx: Prisma.TransactionClient) => Promise<void>,
    code: string,
    constraint: string,
  ): Promise<void> {
    const operation = rolledTransaction(work);
    await expect(operation).rejects.toMatchObject({
      code: 'P2010',
      meta: { code },
    });
    await expect(operation).rejects.toThrow(constraint);
  }

  it(
    'has exactly the specified demo accounts/products, hashed passwords, and no workflow data',
    assertSeed,
    30000,
  );

  it('uses READ COMMITTED inside the NestJS Prisma transaction boundary', async () => {
    await prisma.$transaction(async (tx) => {
      const result = await tx.$queryRaw<
        Array<{ transaction_isolation: string }>
      >`SHOW transaction_isolation`;
      expect(result[0].transaction_isolation).toBe('read committed');
    });
  });

  it.each([-1n, 9007199254740992n])(
    'rejects stock %s through direct SQL',
    async (stock) => {
      await rejectsSql(
        async (tx) => {
          await tx.$executeRaw`UPDATE products SET available_quantity = ${stock} WHERE id = 'product-headphones'`;
        },
        '23514',
        'products_stock_check',
      );
    },
  );

  it.each([0n, -1n, 9007199254740992n])(
    'rejects order quantity %s through direct SQL',
    async (quantity) => {
      await rejectsSql(
        async (tx) => {
          await tx.$executeRaw`UPDATE orders SET quantity = ${quantity}, unit_price_minor = 0, total_minor = 0 WHERE id = 'fixture-order'`;
        },
        '23514',
        'orders_quantity_check',
      );
    },
  );

  it('rejects negative product prices', async () => {
    await rejectsSql(
      async (tx) => {
        await tx.$executeRaw`UPDATE products SET unit_price_minor = -1 WHERE id = 'product-keyboard'`;
      },
      '23514',
      'products_price_check',
    );
  });

  it('rejects a total that differs from quantity times the price snapshot', async () => {
    await rejectsSql(
      async (tx) => {
        await tx.$executeRaw`UPDATE orders SET total_minor = 1 WHERE id = 'fixture-order'`;
      },
      '23514',
      'orders_total_check',
    );
  });

  it('allows the same retry key for different customers but rejects repeats for one customer', async () => {
    await rejectsSql(
      async (tx) => {
        await tx.$executeRaw`INSERT INTO order_idempotency (customer_id, key, product_id, quantity) VALUES ('user-alice', 'retry-key', 'product-keyboard', 1), ('user-bob', 'retry-key', 'product-keyboard', 1)`;
        await tx.$executeRaw`INSERT INTO order_idempotency (customer_id, key, product_id, quantity) VALUES ('user-alice', 'retry-key', 'product-keyboard', 1)`;
      },
      '23505',
      'Key (customer_id, key)',
    );
  });

  it('rejects duplicate payment event IDs even with a different payload', async () => {
    await rejectsSql(
      async (tx) => {
        await tx.$executeRaw`INSERT INTO payment_events (event_id, order_id, type, outcome) VALUES ('event-one', 'fixture-order', 'PAYMENT_SUCCEEDED', 'APPLIED')`;
        await tx.$executeRaw`INSERT INTO payment_events (event_id, order_id, type, outcome) VALUES ('event-one', 'fixture-order', 'PAYMENT_FAILED', 'IGNORED')`;
      },
      '23505',
      'Key (event_id)',
    );
  });

  it('rejects duplicate history sequence numbers', async () => {
    await rejectsSql(
      async (tx) => {
        await tx.$executeRaw`INSERT INTO order_transitions (order_id, sequence, from_status, to_status, reason) VALUES ('fixture-order', 0, NULL, 'PENDING', 'ORDER_CREATED')`;
        await tx.$executeRaw`INSERT INTO order_transitions (order_id, sequence, from_status, to_status, reason) VALUES ('fixture-order', 0, NULL, 'PENDING', 'ORDER_CREATED')`;
      },
      '23505',
      'Key (order_id, sequence)',
    );
  });

  it('rejects a terminal history entry without a PENDING source', async () => {
    await rejectsSql(
      async (tx) => {
        await tx.$executeRaw`INSERT INTO order_transitions (order_id, sequence, from_status, to_status, reason) VALUES ('fixture-order', 1, NULL, 'CONFIRMED', 'PAYMENT_SUCCEEDED')`;
      },
      '23514',
      'order_transitions_state_check',
    );
  });

  it('rejects history beyond the one initial and one terminal transition', async () => {
    await rejectsSql(
      async (tx) => {
        await tx.$executeRaw`INSERT INTO order_transitions (order_id, sequence, from_status, to_status, reason) VALUES ('fixture-order', 2, 'PENDING', 'FAILED', 'PAYMENT_FAILED')`;
      },
      '23514',
      'order_transitions_state_check',
    );
  });

  it('accepts the contracted initial and terminal history shapes', async () => {
    await expect(
      rolledTransaction(async (tx) => {
        await tx.orderTransition.create({
          data: {
            orderId: 'fixture-order',
            sequence: 0,
            toStatus: 'PENDING',
            reason: 'ORDER_CREATED',
          },
        });
        await tx.orderTransition.create({
          data: {
            orderId: 'fixture-order',
            sequence: 1,
            fromStatus: 'PENDING',
            toStatus: 'CANCELLED',
            reason: 'CUSTOMER_CANCELLED',
          },
        });
      }),
    ).rejects.toThrow('fixture rollback');
  });

  it('rejects orders referencing unknown customers', async () => {
    await rejectsSql(
      async (tx) => {
        await tx.$executeRaw`UPDATE orders SET customer_id = 'unknown-user' WHERE id = 'fixture-order'`;
      },
      '23503',
      'orders_customer_id_fkey',
    );
  });

  it('rejects orders referencing unknown products', async () => {
    await rejectsSql(
      async (tx) => {
        await tx.$executeRaw`UPDATE orders SET product_id = 'unknown-product' WHERE id = 'fixture-order'`;
      },
      '23503',
      'orders_product_id_fkey',
    );
  });

  it('rejects accepted events referencing unknown orders', async () => {
    await rejectsSql(
      async (tx) => {
        await tx.$executeRaw`INSERT INTO payment_events (event_id, order_id, type) VALUES ('unknown-event', 'unknown-order', 'PAYMENT_SUCCEEDED')`;
        // Phase 5 defers this FK to commit; force its check before the
        // test harness's intentional rollback so integrity is still proven.
        await tx.$executeRaw`SET CONSTRAINTS payment_events_order_id_fkey IMMEDIATE`;
      },
      '23503',
      'payment_events_order_id_fkey',
    );
  });

  it('preserves reserved stock when seeding, then clears workflow data and restores exact demo data on two resets', async () => {
    try {
      await prisma.$transaction(async (tx) => {
        await fixture(tx);
        await tx.product.update({
          where: { id: 'product-headphones' },
          data: { availableQuantity: 0n },
        });
        await tx.orderTransition.create({
          data: {
            orderId: 'fixture-order',
            sequence: 0,
            toStatus: 'PENDING',
            reason: 'ORDER_CREATED',
          },
        });
        await tx.orderIdempotency.create({
          data: {
            customerId: 'user-alice',
            key: 'seed-preservation',
            productId: 'product-keyboard',
            quantity: 1n,
            orderId: 'fixture-order',
          },
        });
        await tx.paymentEvent.create({
          data: {
            eventId: 'seed-event',
            orderId: 'fixture-order',
            type: 'PAYMENT_SUCCEEDED',
            outcome: 'IGNORED',
          },
        });
      });
      await seedDatabase(prisma);
      await seedDatabase(prisma);
      expect(
        (
          await prisma.product.findUniqueOrThrow({
            where: { id: 'product-headphones' },
          })
        ).availableQuantity,
      ).toBe(0n);
      expect(await prisma.order.count()).toBe(1);
      await seedDatabase(prisma, true);
      await assertSeed();
      await seedDatabase(prisma, true);
      await assertSeed();
    } finally {
      await seedDatabase(prisma, true);
    }
  }, 30000);
});
