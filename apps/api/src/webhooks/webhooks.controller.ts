import { Body, Controller, HttpCode, Post, UseGuards } from '@nestjs/common';
import { WebhookSecretGuard } from './webhook-secret.guard';
import { WebhooksService } from './webhooks.service';
import { PaymentEventDto } from './dto/payment-event.dto';

@Controller('webhooks')
@UseGuards(WebhookSecretGuard)
export class WebhooksController {
  constructor(private readonly webhooks: WebhooksService) {}
  @Post('payments')
  @HttpCode(200)
  payment(@Body() input: PaymentEventDto) {
    return this.webhooks.payment(input);
  }
}
