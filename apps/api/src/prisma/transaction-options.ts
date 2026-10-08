import { Prisma } from '@prisma/client';

export const transactionOptions = {
  isolationLevel: Prisma.TransactionIsolationLevel.ReadCommitted,
} as const;
