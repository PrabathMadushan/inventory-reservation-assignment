import { PrismaClient } from '@prisma/client';
import { seedDatabase } from './seed-data';
import { transactionOptions } from '../src/prisma/transaction-options';

async function main(): Promise<void> {
  const url = new URL(process.env.DATABASE_URL!);
  const database = decodeURIComponent(url.pathname.slice(1));
  // Even direct invocation of the seed CLI cannot reset a remote database.
  if (
    !['localhost', '127.0.0.1', '[::1]'].includes(url.hostname) ||
    !['inventory_development', 'inventory_test'].includes(database)
  ) {
    throw new Error(
      'Demo seed/reset requires a local inventory_development or inventory_test database.',
    );
  }
  const reset = process.argv.includes('--reset');
  console.log(
    `${reset ? 'Resetting (deletes demo data)' : 'Seeding missing demo data in'} ${url.hostname}:${url.port}/${database}`,
  );
  const prisma = new PrismaClient({ transactionOptions });
  try {
    await seedDatabase(prisma, reset);
    console.log(
      reset
        ? 'Reset complete: 3 users, 5 products, no orders or events.'
        : 'Seed complete; existing inventory and orders preserved.',
    );
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : 'Seed failed.');
  process.exitCode = 1;
});
