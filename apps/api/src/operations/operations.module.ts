import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { OrdersModule } from '../orders/orders.module';
import { PrismaModule } from '../prisma/prisma.module';
import { OperationsController } from './operations.controller';

@Module({
  imports: [AuthModule, OrdersModule, PrismaModule],
  controllers: [OperationsController],
})
export class OperationsModule {}
