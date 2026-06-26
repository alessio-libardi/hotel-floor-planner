import { Body, Controller, Delete, Get, Header, Param, Patch, Post } from '@nestjs/common';
import { AppService } from './app.service';

@Controller('plan-items')
export class PlanController {
  constructor(private readonly appService: AppService) {}

  @Get()
  @Header('Cache-Control', 'no-store')
  @Header('Pragma', 'no-cache')
  getPlanItems() {
    return this.appService.getPlanItems();
  }

  @Post()
  createPlanItem(@Body() dto: { type: 'table' | 'column' | 'label' }) {
    return this.appService.createPlanItem(dto.type);
  }

  @Patch(':itemId')
  updatePlanItem(
    @Param('itemId') itemId: string,
    @Body()
    dto: Partial<{
      x: number;
      y: number;
      width: number;
      height: number;
      text: string;
      tableNumber: number | null;
      roomNumber: number | null;
    }>
  ) {
    return this.appService.updatePlanItem(itemId, dto);
  }

  @Delete(':itemId')
  deletePlanItem(@Param('itemId') itemId: string) {
    return this.appService.deletePlanItem(itemId);
  }
}