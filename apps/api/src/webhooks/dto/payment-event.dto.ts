import { IsEnum, IsString, Matches } from 'class-validator';
import { PaymentEventType } from '@prisma/client';

export class PaymentEventDto {
  @IsString()
  @Matches(/\S/)
  eventId!: string;
  @IsString()
  @Matches(/\S/)
  orderId!: string;
  @IsEnum(PaymentEventType)
  type!: PaymentEventType;
}
