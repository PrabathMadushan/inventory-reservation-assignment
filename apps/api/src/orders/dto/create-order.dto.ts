import { IsInt, IsString, Matches, Max, Min } from 'class-validator';

export class CreateOrderDto {
  @IsString()
  @Matches(/\S/, { message: 'productId must be nonempty.' })
  productId!: string;

  @IsInt()
  @Min(1)
  @Max(Number.MAX_SAFE_INTEGER)
  quantity!: number;
}
