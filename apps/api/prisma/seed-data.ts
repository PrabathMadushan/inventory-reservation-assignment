import { PrismaClient, UserRole } from '@prisma/client';
import { hash } from 'bcrypt';
import { transactionOptions } from '../src/prisma/transaction-options';

export const demoUsers = [
  { id: 'user-alice', email: 'alice@example.test', role: UserRole.CUSTOMER },
  { id: 'user-bob', email: 'bob@example.test', role: UserRole.CUSTOMER },
  { id: 'user-ops', email: 'ops@example.test', role: UserRole.OPERATIONS },
];

export const demoProducts = [
  {
    id: 'product-keyboard',
    name: 'Mechanical Keyboard',
    unitPriceMinor: 1500000n,
    availableQuantity: 20n,
  },
  {
    id: 'product-hub',
    name: 'USB C Hub',
    unitPriceMinor: 800000n,
    availableQuantity: 20n,
  },
  {
    id: 'product-stand',
    name: 'Laptop Stand',
    unitPriceMinor: 600000n,
    availableQuantity: 20n,
  },
  {
    id: 'product-mouse',
    name: 'Wireless Mouse',
    unitPriceMinor: 450000n,
    availableQuantity: 20n,
  },
  {
    id: 'product-headphones',
    name: 'Limited Edition Headphones',
    unitPriceMinor: 2500000n,
    availableQuantity: 1n,
  },
];

export async function seedDatabase(
  prisma: PrismaClient,
  reset = false,
): Promise<void> {
  // Hash before opening the transaction; never store the demo plaintext password.
  const passwords = await Promise.all(
    demoUsers.map(() => hash('DemoPass123!', 12)),
  );
  await prisma.$transaction(async (tx) => {
    if (reset) {
      // Explicit tables, no CASCADE: unrelated tables must never be cleared.
      await tx.$executeRaw`TRUNCATE TABLE payment_events, order_transitions, order_idempotency, orders, products, users`;
    }
    for (const [index, user] of demoUsers.entries()) {
      await tx.user.upsert({
        where: { email: user.email },
        update: {},
        create: { ...user, passwordHash: passwords[index] },
      });
    }
    for (const product of demoProducts) {
      await tx.product.upsert({
        where: { id: product.id },
        update: {},
        create: { ...product, currency: 'LKR' },
      });
    }
  }, transactionOptions);
}
