import { Module } from '@nestjs/common';
import { OrdersController } from './orders.controller';
import { OrdersService } from './orders.service';
import { OrderTransitionsService } from './order-transitions.service';
import { AuthModule } from '../auth/auth.module';
import { PrismaModule } from '../prisma/prisma.module';

@Module({
  imports: [AuthModule, PrismaModule],
  exports: [OrdersService, OrderTransitionsService],
  controllers: [OrdersController],
  providers: [OrdersService, OrderTransitionsService],
})
export class OrdersModule {}
