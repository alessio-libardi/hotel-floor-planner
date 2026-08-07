import { FloorViewModel } from '../../floor.models';
import { PlanItem } from '../../plan-layout.store';
import {
  getRoomDepartureStatus,
  RoomDepartureStatus,
} from '../../room-departure-status';

export interface SeatingRoomViewModel {
  readonly id: string;
  readonly number: number;
  readonly note: string | null;
  readonly checkedToday: boolean;
  readonly departureStatus: RoomDepartureStatus;
  readonly tableNumber: string | null;
}

export interface SeatingFloorViewModel {
  readonly id: string;
  readonly number: number;
  readonly rooms: readonly SeatingRoomViewModel[];
}

export interface SeatingRoomCheckChange {
  readonly roomId: string;
  readonly checked: boolean;
}

export interface SeatingPageViewModel {
  readonly floors: readonly SeatingFloorViewModel[];
}

export function createSeatingFloors(
  floors: readonly FloorViewModel[],
  items: readonly PlanItem[],
  today: string
): SeatingFloorViewModel[] {
  const tableNumberByRoom = new Map<number, string>();

  for (const item of items) {
    if (item.type !== 'table' || item.displayTableNumber == null) {
      continue;
    }

    for (const roomNumber of item.roomNumbers) {
      tableNumberByRoom.set(roomNumber, item.displayTableNumber);
    }
  }

  const todayDate = dateOnlyAtLocalMidnight(today);

  return floors.map((floor) => ({
    id: floor.id,
    number: floor.number,
    rooms: floor.rooms.map((room) => ({
      id: room.id,
      number: room.number,
      note: room.note,
      checkedToday: room.checkedDate === today,
      departureStatus: getRoomDepartureStatus(room.departureDate, todayDate),
      tableNumber: tableNumberByRoom.get(room.number) ?? null,
    })),
  }));
}

function dateOnlyAtLocalMidnight(value: string): Date {
  const [year, month, day] = value.split('-').map(Number);
  return new Date(year, month - 1, day);
}
