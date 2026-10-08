import { Injectable, InternalServerErrorException } from '@nestjs/common';
import type { Prisma, OrderStatus, TransitionReason } from '@prisma/client';

export type LockedOrder = {
  id: string;
  customer_id: string;
  product_id: string;
  quantity: bigint;
  status: OrderStatus;
};
type Terminal = 'CONFIRMED' | 'FAILED' | 'CANCELLED';

@Injectable()
export class OrderTransitionsService {
  async lock(tx: Prisma.TransactionClient, id: string, customerId?: string) {
    const rows =
      customerId === undefined
        ? await tx.$queryRaw<
            LockedOrder[]
          >`SELECT id, customer_id, product_id, quantity, status FROM orders WHERE id = ${id} FOR UPDATE`
        : await tx.$queryRaw<
            LockedOrder[]
          >`SELECT id, customer_id, product_id, quantity, status FROM orders WHERE id = ${id} AND customer_id = ${customerId} FOR UPDATE`;
    return rows[0] ?? null;
  }
  async apply(
    tx: Prisma.TransactionClient,
    order: LockedOrder,
    target: Terminal,
    reason: TransitionReason,
  ): Promise<boolean> {
    const changed = await tx.$queryRaw<Array<{ updated_at: Date }>>`
      UPDATE orders SET status = ${target}::order_status, updated_at = clock_timestamp()
      WHERE id = ${order.id} AND customer_id = ${order.customer_id} AND status = 'PENDING'
      RETURNING updated_at`;
    if (!changed.length) return false;
    if (target !== 'CONFIRMED') {
      const released = await tx.$executeRaw`UPDATE products
        SET available_quantity = available_quantity + ${order.quantity}
        WHERE id = ${order.product_id}`;
      if (released !== 1) throw new InternalServerErrorException();
    }
    await tx.orderTransition.create({
      data: {
        orderId: order.id,
        sequence: 1,
        fromStatus: 'PENDING',
        toStatus: target,
        reason,
        occurredAt: changed[0].updated_at,
      },
    });
    return true;
  }
  async recordCreation(
    tx: Prisma.TransactionClient,
    orderId: string,
  ): Promise<void> {
    await tx.orderTransition.create({
      data: {
        orderId,
        sequence: 0,
        fromStatus: null,
        toStatus: 'PENDING',
        reason: 'ORDER_CREATED',
      },
    });
  }
}
