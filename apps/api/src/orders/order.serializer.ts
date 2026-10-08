import { Prisma } from '@prisma/client';
import { toSafeInteger } from '../common/serialization/safe-integer';

export const orderHistory = {
  history: { orderBy: { sequence: 'asc' as const } },
} satisfies Prisma.OrderInclude;
type OrderRecord = Prisma.OrderGetPayload<{ include: typeof orderHistory }>;

export function serializeOrder(order: OrderRecord) {
  return {
    id: order.id,
    customerId: order.customerId,
    productId: order.productId,
    productName: order.productName,
    quantity: toSafeInteger(order.quantity),
    unitPriceMinor: toSafeInteger(order.unitPriceMinor),
    totalMinor: toSafeInteger(order.totalMinor),
    currency: order.currency,
    status: order.status,
    createdAt: order.createdAt.toISOString(),
    updatedAt: order.updatedAt.toISOString(),
    history: order.history.map((entry) => ({
      fromStatus: entry.fromStatus,
      toStatus: entry.toStatus,
      reason: entry.reason,
      occurredAt: entry.occurredAt.toISOString(),
    })),
  };
}
