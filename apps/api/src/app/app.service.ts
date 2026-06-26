import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { UpdateRoomDto } from './dto/update-room.dto';
import { FloorEntity } from './entities/floor.entity';
import { PlanItemEntity } from './entities/plan-item.entity';
import { RoomEntity } from './entities/room.entity';

@Injectable()
export class AppService {
  constructor(
    @InjectRepository(FloorEntity)
    private readonly floorRepository: Repository<FloorEntity>,
    @InjectRepository(RoomEntity)
    private readonly roomRepository: Repository<RoomEntity>,
    @InjectRepository(PlanItemEntity)
    private readonly planItemRepository: Repository<PlanItemEntity>
  ) {}

  async getFloors() {
    const floors = await this.floorRepository.find({
      relations: { rooms: true },
      order: { number: 'ASC', rooms: { position: 'ASC' } },
    });

    return floors.map((floor) => ({
      id: floor.id,
      number: floor.number,
      rooms: floor.rooms.map((room) => ({
        id: room.id,
        label: room.label,
        number: floor.number * 100 + room.position,
      })),
    }));
  }

  async createFloor() {
    const maxFloor = await this.floorRepository
      .createQueryBuilder('floor')
      .select('MAX(floor.number)', 'max')
      .getRawOne<{ max: string | null }>();

    const floorNumber = Number(maxFloor?.max || 0) + 1;

    const floor = this.floorRepository.create({
      number: floorNumber,
    });

    await this.floorRepository.save(floor);

    return {
      id: floor.id,
      number: floor.number,
      rooms: [],
    };
  }

  async deleteFloor(floorId: string) {
    const floor = await this.floorRepository.findOne({ where: { id: floorId } });

    if (!floor) {
      throw new NotFoundException('Floor not found');
    }

    await this.floorRepository.delete(floorId);

    return { deleted: true };
  }

  async createRoom(floorId: string) {
    const floor = await this.floorRepository.findOne({
      where: { id: floorId },
      relations: { rooms: true },
    });

    if (!floor) {
      throw new NotFoundException('Floor not found');
    }

    const nextPosition = Math.max(0, ...floor.rooms.map((room) => room.position)) + 1;

    const room = this.roomRepository.create({
      floor,
      position: nextPosition,
      label: `Room ${floor.number * 100 + nextPosition}`,
    });

    await this.roomRepository.save(room);

    return {
      id: room.id,
      label: room.label,
      number: floor.number * 100 + room.position,
    };
  }

  async getPlanItems() {
    const items = await this.planItemRepository.find({
      order: { type: 'ASC', tableNumber: 'ASC', id: 'ASC' },
    });

    return items.map((item) => ({
      id: item.id,
      type: item.type,
      x: item.x,
      y: item.y,
      width: item.width,
      height: item.height,
      text: item.text,
      tableNumber: item.tableNumber,
      roomNumber: item.roomNumber,
    }));
  }

  async createPlanItem(type: 'table' | 'column' | 'label') {
    const defaults = {
      x: 48,
      y: 48,
      width: type === 'label' ? 120 : 74,
      height: type === 'label' ? 28 : 74,
      text: type === 'column' ? 'Column' : '',
      tableNumber: null as number | null,
      roomNumber: null as number | null,
    };

    if (type === 'table') {
      const max = await this.planItemRepository
        .createQueryBuilder('item')
        .select('MAX(item.tableNumber)', 'max')
        .where('item.type = :type', { type: 'table' })
        .getRawOne<{ max: string | null }>();

      defaults.tableNumber = Number(max?.max || 0) + 1;
    }

    const item = this.planItemRepository.create({
      type,
      ...defaults,
    });

    const saved = await this.planItemRepository.save(item);

    return {
      id: saved.id,
      type: saved.type,
      x: saved.x,
      y: saved.y,
      width: saved.width,
      height: saved.height,
      text: saved.text,
      tableNumber: saved.tableNumber,
      roomNumber: saved.roomNumber,
    };
  }

  async updatePlanItem(
    itemId: string,
    patch: Partial<{
      x: number;
      y: number;
      width: number;
      height: number;
      text: string;
      tableNumber: number | null;
      roomNumber: number | null;
    }>
  ) {
    const item = await this.planItemRepository.findOne({ where: { id: itemId } });

    if (!item) {
      throw new NotFoundException('Plan item not found');
    }

    Object.assign(item, patch);
    const saved = await this.planItemRepository.save(item);

    return {
      id: saved.id,
      type: saved.type,
      x: saved.x,
      y: saved.y,
      width: saved.width,
      height: saved.height,
      text: saved.text,
      tableNumber: saved.tableNumber,
      roomNumber: saved.roomNumber,
    };
  }

  async deletePlanItem(itemId: string) {
    const item = await this.planItemRepository.findOne({ where: { id: itemId } });

    if (!item) {
      throw new NotFoundException('Plan item not found');
    }

    await this.planItemRepository.delete(itemId);

    return { deleted: true };
  }

  async updateRoom(floorId: string, roomId: string, dto: UpdateRoomDto) {
    const room = await this.roomRepository.findOne({
      where: { id: roomId, floor: { id: floorId } },
      relations: { floor: true },
    });

    if (!room) {
      throw new NotFoundException('Room not found');
    }

    if (dto.label !== undefined) {
      room.label = dto.label.trim();
    }

    await this.roomRepository.save(room);

    return {
      id: room.id,
      label: room.label,
      number: room.floor.number * 100 + room.position,
    };
  }

  async deleteRoom(floorId: string, roomId: string) {
    const room = await this.roomRepository.findOne({
      where: { id: roomId, floor: { id: floorId } },
      relations: { floor: true },
    });

    if (!room) {
      throw new NotFoundException('Room not found');
    }

    await this.roomRepository.delete(roomId);
    await this.renumberRooms(floorId);

    return { deleted: true };
  }

  private async renumberRooms(floorId: string): Promise<void> {
    const floor = await this.floorRepository.findOne({
      where: { id: floorId },
      relations: { rooms: true },
    });

    if (!floor) {
      return;
    }

    const rooms = [...floor.rooms].sort((left, right) => left.position - right.position);

    for (let index = 0; index < rooms.length; index += 1) {
      const room = rooms[index];

      if (room.position !== index) {
        room.position = index;
        await this.roomRepository.save(room);
      }
    }
  }
}
