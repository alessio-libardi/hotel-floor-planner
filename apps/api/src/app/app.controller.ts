import { Body, Controller, Delete, Get, Header, Param, Patch, Post } from '@nestjs/common';
import { AppService } from './app.service';
import { UpdateRoomDto } from './dto/update-room.dto';

@Controller('floors')
export class AppController {
  constructor(private readonly appService: AppService) {}

  @Get()
  @Header('Cache-Control', 'no-store')
  @Header('Pragma', 'no-cache')
  getFloors() {
    return this.appService.getFloors();
  }

  @Post()
  createFloor() {
    return this.appService.createFloor();
  }

  @Delete(':floorId')
  deleteFloor(@Param('floorId') floorId: string) {
    return this.appService.deleteFloor(floorId);
  }

  @Post(':floorId/rooms')
  createRoom(@Param('floorId') floorId: string) {
    return this.appService.createRoom(floorId);
  }

  @Patch(':floorId/rooms/:roomId')
  updateRoom(
    @Param('floorId') floorId: string,
    @Param('roomId') roomId: string,
    @Body() dto: UpdateRoomDto
  ) {
    return this.appService.updateRoom(floorId, roomId, dto);
  }

  @Delete(':floorId/rooms/:roomId')
  deleteRoom(@Param('floorId') floorId: string, @Param('roomId') roomId: string) {
    return this.appService.deleteRoom(floorId, roomId);
  }
}
