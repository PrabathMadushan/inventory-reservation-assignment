import {
  ConflictException,
  Injectable,
  InternalServerErrorException,
  NotFoundException,
} from '@nestjs/common';
import type { Prisma, PaymentEvent } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { transactionOptions } from '../prisma/transaction-options';
import { OrderTransitionsService } from '../orders/order-transitions.service';
import { PaymentEventDto } from './dto/payment-event.dto';

@Injectable()
export class WebhooksService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly transitions: OrderTransitionsService,
  ) {}
  private async replay(
    tx: Prisma.TransactionClient,
    event: PaymentEvent,
    input: PaymentEventDto,
  ) {
    if (event.orderId !== input.orderId || event.type !== input.type)
      throw new ConflictException({
        code: 'EVENT_ID_CONFLICT',
        message: 'This event ID was already accepted with a different payload.',
      });
    if (!event.outcome) throw new InternalServerErrorException();
    const order = await this.transitions.lock(tx, event.orderId);
    if (!order) throw new NotFoundException('Order not found.');
    return {
      eventId: event.eventId,
      orderId: event.orderId,
      outcome: 'DUPLICATE' as const,
      orderStatus: order.status,
    };
  }
  payment(input: PaymentEventDto) {
    return this.prisma.$transaction(
      async (tx) => {
        const existing = await tx.paymentEvent.findUnique({
          where: { eventId: input.eventId },
        });
        if (existing) return this.replay(tx, existing, input);
        const exists = await tx.order.findUnique({
          where: { id: input.orderId },
          select: { id: true },
        });
        if (!exists) throw new NotFoundException('Order not found.');
        const claimed = await tx.$queryRaw<Array<{ event_id: string }>>`
        INSERT INTO payment_events (event_id, order_id, type)
        VALUES (${input.eventId}, ${input.orderId}, ${input.type}::payment_event_type)
        ON CONFLICT (event_id) DO NOTHING RETURNING event_id`;
        if (!claimed.length) {
          const winner = await tx.paymentEvent.findUnique({
            where: { eventId: input.eventId },
          });
          if (!winner) throw new InternalServerErrorException();
          return this.replay(tx, winner, input);
        }
        const order = await this.transitions.lock(tx, input.orderId);
        if (!order) throw new NotFoundException('Order not found.');
        const target =
          input.type === 'PAYMENT_SUCCEEDED' ? 'CONFIRMED' : 'FAILED';
        const applied =
          order.status === 'PENDING' &&
          (await this.transitions.apply(tx, order, target, input.type));
        const outcome = applied ? ('APPLIED' as const) : ('IGNORED' as const);
        await tx.paymentEvent.update({
          where: { eventId: input.eventId },
          data: { outcome },
        });
        return {
          eventId: input.eventId,
          orderId: input.orderId,
          outcome,
          orderStatus: applied ? target : order.status,
        };
      },
      { ...transactionOptions, timeout: 10000 },
    );
  }
}
