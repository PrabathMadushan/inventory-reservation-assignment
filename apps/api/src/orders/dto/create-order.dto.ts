import { IsInt, IsString, Matches, Max, MaxLength, Min } from 'class-validator';

export class CreateOrderDto {
  @IsString()
  @Matches(/\S/, { message: 'productId must be nonempty.' })
  @MaxLength(256)
  productId!: string;

  @IsInt()
  @Min(1)
  @Max(Number.MAX_SAFE_INTEGER)
  quantity!: number;
}
