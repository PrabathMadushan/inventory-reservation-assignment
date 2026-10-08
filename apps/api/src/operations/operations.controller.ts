import { Controller, Get, Param, Query, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { OrdersService } from '../orders/orders.service';
import { ListOrdersQueryDto } from '../orders/dto/list-orders-query.dto';

@Controller('operations')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('OPERATIONS')
export class OperationsController {
  constructor(private readonly orders: OrdersService) {}
  @Get('orders')
  list(@Query() query: ListOrdersQueryDto) {
    return this.orders.listOperations(query);
  }
  @Get('orders/:id')
  detail(@Param('id') id: string) {
    return this.orders.getOperations(id);
  }
}
