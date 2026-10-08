import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { toSafeInteger } from '../common/serialization/safe-integer';

@Injectable()
export class ProductsService {
  constructor(private readonly prisma: PrismaService) {}

  async list() {
    const products = await this.prisma.product.findMany({
      orderBy: [{ name: 'asc' }, { id: 'asc' }],
      select: {
        id: true,
        name: true,
        unitPriceMinor: true,
        currency: true,
        availableQuantity: true,
      },
    });
    return {
      items: products.map((product) => ({
        ...product,
        unitPriceMinor: toSafeInteger(product.unitPriceMinor),
        availableQuantity: toSafeInteger(product.availableQuantity),
      })),
    };
  }
}
