import { Module } from '@nestjs/common';
import { OrdersModule } from '../orders/orders.module';
import { PrismaModule } from '../prisma/prisma.module';
import { WebhooksController } from './webhooks.controller';
import { WebhooksService } from './webhooks.service';
import { WebhookSecretGuard } from './webhook-secret.guard';

@Module({
  imports: [OrdersModule, PrismaModule],
  controllers: [WebhooksController],
  providers: [WebhooksService, WebhookSecretGuard],
})
export class WebhooksModule {}
