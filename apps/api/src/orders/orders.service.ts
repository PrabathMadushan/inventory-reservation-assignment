import {
  BadRequestException,
  ConflictException,
  Injectable,
  InternalServerErrorException,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import type { Currency } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { transactionOptions } from '../prisma/transaction-options';
import { CreateOrderDto } from './dto/create-order.dto';
import { ListOrdersQueryDto } from './dto/list-orders-query.dto';
import { orderHistory, serializeOrder } from './order.serializer';
import { OrderTransitionsService } from './order-transitions.service';

type ReservedProduct = {
  id: string;
  name: string;
  unit_price_minor: bigint;
  currency: Currency;
};

@Injectable()
export class OrdersService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly transitions: OrderTransitionsService,
  ) {}

  async create(
    customerId: string,
    input: CreateOrderDto,
    key: string | undefined,
  ) {
    if (typeof key !== 'string' || !key.trim())
      throw new BadRequestException('Idempotency-Key is required.');
    if (key.length > 256)
      throw new BadRequestException(
        'Idempotency-Key must be at most 256 characters.',
      );
    const quantity = BigInt(input.quantity);
    return this.prisma.$transaction(
      async (tx) => {
        const claim = await tx.$queryRaw<Array<{ key: string }>>`
        INSERT INTO order_idempotency (customer_id, key, product_id, quantity)
        VALUES (${customerId}, ${key}, ${input.productId}, ${quantity})
        ON CONFLICT (customer_id, key) DO NOTHING RETURNING key`;
        if (!claim.length) {
          // A separate READ COMMITTED statement sees the committed winning claim.
          const existing = await tx.orderIdempotency.findUnique({
            where: { customerId_key: { customerId, key } },
          });
          if (!existing?.orderId) throw new InternalServerErrorException();
          if (
            existing.productId !== input.productId ||
            existing.quantity !== quantity
          ) {
            throw new ConflictException({
              code: 'IDEMPOTENCY_CONFLICT',
              message:
                'This retry key was already used for a different order request.',
            });
          }
          // Hold a shared order-row lock while loading status and history.
          // Future terminal transitions must acquire this same row for update.
          await tx.$queryRaw`SELECT id FROM orders
            WHERE id = ${existing.orderId} AND customer_id = ${customerId}
            FOR SHARE`;
          return {
            replayed: true,
            order: await this.readCustomer(tx, customerId, existing.orderId),
          };
        }
        const reserved = await tx.$queryRaw<ReservedProduct[]>`
        UPDATE products SET available_quantity = available_quantity - ${quantity}
        WHERE id = ${input.productId} AND available_quantity >= ${quantity}
        RETURNING id, name, unit_price_minor, currency`;
        const product = reserved[0];
        if (!product) {
          const exists = await tx.product.findUnique({
            where: { id: input.productId },
            select: { id: true },
          });
          if (!exists) throw new NotFoundException('Product not found.');
          throw new ConflictException({
            code: 'INSUFFICIENT_STOCK',
            message: 'Not enough stock is available for this quantity.',
          });
        }
        const total = quantity * product.unit_price_minor;
        if (total > BigInt(Number.MAX_SAFE_INTEGER))
          throw new BadRequestException(
            'The order total exceeds the supported integer range.',
          );
        const order = await tx.order.create({
          data: {
            customerId,
            productId: product.id,
            productName: product.name,
            quantity,
            unitPriceMinor: product.unit_price_minor,
            totalMinor: total,
            currency: product.currency,
          },
        });
        await this.transitions.recordCreation(tx, order.id);
        await tx.orderIdempotency.update({
          where: { customerId_key: { customerId, key } },
          data: { orderId: order.id },
        });
        return {
          replayed: false,
          order: await this.readCustomer(tx, customerId, order.id),
        };
      },
      { ...transactionOptions, timeout: 10000 },
    );
  }

  private async readCustomer(
    tx: Prisma.TransactionClient,
    customerId: string,
    id: string,
  ) {
    return this.readOrder(tx, id, customerId);
  }

  private async readOrder(
    tx: Prisma.TransactionClient,
    id: string,
    customerId?: string,
  ) {
    const order = await tx.order.findFirst({
      where: { id, ...(customerId === undefined ? {} : { customerId }) },
      include: orderHistory,
    });
    if (!order) throw new NotFoundException('Order not found.');
    return serializeOrder(order);
  }

  getCustomer(customerId: string, id: string) {
    // Read-only snapshot keeps status/history consistent as later transitions run.
    return this.prisma.$transaction(
      (tx) => this.readCustomer(tx, customerId, id),
      { isolationLevel: Prisma.TransactionIsolationLevel.RepeatableRead },
    );
  }

  cancel(customerId: string, id: string) {
    return this.prisma.$transaction(
      async (tx) => {
        const order = await this.transitions.lock(tx, id, customerId);
        if (!order) throw new NotFoundException('Order not found.');
        if (
          order.status !== 'PENDING' ||
          !(await this.transitions.apply(
            tx,
            order,
            'CANCELLED',
            'CUSTOMER_CANCELLED',
          ))
        )
          throw new ConflictException({
            code: 'INVALID_TRANSITION',
            message: 'Only a pending order can be cancelled.',
          });
        return this.readCustomer(tx, customerId, id);
      },
      { ...transactionOptions, timeout: 10000 },
    );
  }

  listCustomer(customerId: string, query: ListOrdersQueryDto) {
    return this.listOrders(query, customerId);
  }

  listOperations(query: ListOrdersQueryDto) {
    return this.listOrders(query);
  }

  getOperations(id: string) {
    return this.prisma.$transaction((tx) => this.readOrder(tx, id), {
      isolationLevel: Prisma.TransactionIsolationLevel.RepeatableRead,
    });
  }

  private listOrders(query: ListOrdersQueryDto, customerId?: string) {
    return this.prisma.$transaction(
      async (tx) => {
        const where = {
          ...(customerId === undefined ? {} : { customerId }),
          ...(query.status ? { status: query.status } : {}),
        };
        const total = await tx.order.count({ where });
        const offset = BigInt(query.page - 1) * BigInt(query.pageSize);
        const orders =
          offset >= BigInt(total)
            ? []
            : await tx.order.findMany({
                where,
                include: orderHistory,
                orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
                skip: Number(offset),
                take: query.pageSize,
              });
        return {
          items: orders.map(serializeOrder),
          page: query.page,
          pageSize: query.pageSize,
          total,
        };
      },
      { isolationLevel: Prisma.TransactionIsolationLevel.RepeatableRead },
    );
  }
}
