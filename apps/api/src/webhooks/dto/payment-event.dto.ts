import { IsEnum, IsString, Matches, MaxLength } from 'class-validator';
import { PaymentEventType } from '@prisma/client';

export class PaymentEventDto {
  @IsString()
  @Matches(/\S/)
  @MaxLength(256)
  eventId!: string;
  @IsString()
  @Matches(/\S/)
  @MaxLength(256)
  orderId!: string;
  @IsEnum(PaymentEventType)
  type!: PaymentEventType;
}
