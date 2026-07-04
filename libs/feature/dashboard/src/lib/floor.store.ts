import { Injectable } from '@angular/core';
import { firstValueFrom, BehaviorSubject } from 'rxjs';
import { FloorPlannerApi } from './floor-planner.api';
import { FloorViewModel, RoomViewModel } from './floor.models';

@Injectable({ providedIn: 'root' })
export class FloorStore {
  private readonly floorsSubject = new BehaviorSubject<FloorViewModel[]>([]);
  private loaded = false;

  readonly floors$ = this.floorsSubject.asObservable();

  constructor(private readonly api: FloorPlannerApi) {}

  get floors(): FloorViewModel[] {
    return this.floorsSubject.value;
  }

  async ensureLoaded(): Promise<void> {
    if (this.loaded) {
      return;
    }

    await this.refresh();
  }

  async refresh(): Promise<void> {
    const floors = await firstValueFrom(this.api.getFloors());
    this.loaded = true;
    this.floorsSubject.next(floors);
  }

  async addFloor(): Promise<void> {
    const previous = this.snapshot();
    const nextNumber =
      Math.max(0, ...this.floors.map((floor) => floor.number)) + 1;
    const tempId = this.tempId('floor');

    this.setFloors([
      ...this.floors,
      { id: tempId, number: nextNumber, rooms: [] },
    ]);

    try {
      const created = await firstValueFrom(this.api.createFloor());
      this.setFloors(
        this.floors.map((floor) => (floor.id === tempId ? created : floor))
      );
    } catch (error) {
      this.setFloors(previous);
      throw error;
    }
  }

  async removeFloor(floorId: string): Promise<void> {
    const previous = this.snapshot();

    this.setFloors(this.floors.filter((floor) => floor.id !== floorId));

    try {
      await firstValueFrom(this.api.deleteFloor(floorId));
    } catch (error) {
      this.setFloors(previous);
      throw error;
    }
  }

  async addRoom(floorId: string): Promise<void> {
    const previous = this.snapshot();
    const floor = this.floors.find((entry) => entry.id === floorId);

    if (!floor) {
      return;
    }

    const nextPosition = floor.rooms.length;
    const tempRoom: RoomViewModel = {
      id: this.tempId('room'),
      number: floor.number * 100 + nextPosition,
      label: `Room ${floor.number * 100 + nextPosition}`,
      arrivalDate: null,
      departureDate: null,
    };

    this.setFloors(
      this.floors.map((entry) =>
        entry.id === floorId
          ? { ...entry, rooms: [...entry.rooms, tempRoom] }
          : entry
      )
    );

    try {
      const created = await firstValueFrom(this.api.createRoom(floorId));

      this.setFloors(
        this.floors.map((entry) => {
          if (entry.id !== floorId) {
            return entry;
          }

          return {
            ...entry,
            rooms: entry.rooms.map((room) =>
              room.id === tempRoom.id ? created : room
            ),
          };
        })
      );
    } catch (error) {
      this.setFloors(previous);
      throw error;
    }
  }

  async removeRoom(floorId: string, roomId: string): Promise<void> {
    const previous = this.snapshot();

    this.setFloors(
      this.floors.map((floor) => {
        if (floor.id !== floorId) {
          return floor;
        }

        const renumberedRooms = floor.rooms
          .filter((room) => room.id !== roomId)
          .sort((left, right) => left.number - right.number)
          .map((room, index) => ({
            ...room,
            number: floor.number * 100 + index,
          }));

        return {
          ...floor,
          rooms: renumberedRooms,
        };
      })
    );

    try {
      await firstValueFrom(this.api.deleteRoom(floorId, roomId));
    } catch (error) {
      this.setFloors(previous);
      throw error;
    }
  }

  async updateRoomDetails(
    floorId: string,
    roomId: string,
    details: Pick<RoomViewModel, 'arrivalDate' | 'departureDate'>
  ): Promise<void> {
    const previous = this.snapshot();

    this.setFloors(
      this.floors.map((floor) => {
        if (floor.id !== floorId) {
          return floor;
        }

        return {
          ...floor,
          rooms: floor.rooms.map((room) =>
            room.id === roomId ? { ...room, ...details } : room
          ),
        };
      })
    );

    try {
      const updated = await firstValueFrom(
        this.api.updateRoomDetails(floorId, roomId, details)
      );

      this.setFloors(
        this.floors.map((floor) => {
          if (floor.id !== floorId) {
            return floor;
          }

          return {
            ...floor,
            rooms: floor.rooms.map((room) =>
              room.id === roomId ? { ...room, ...updated } : room
            ),
          };
        })
      );
    } catch (error) {
      this.setFloors(previous);
      throw error;
    }
  }

  private snapshot(): FloorViewModel[] {
    return this.floors.map((floor) => ({
      ...floor,
      rooms: floor.rooms.map((room) => ({ ...room })),
    }));
  }

  private setFloors(floors: FloorViewModel[]): void {
    this.floorsSubject.next(floors);
  }

  private tempId(prefix: string): string {
    return `tmp_${prefix}_${Date.now()}_${Math.random().toString(16).slice(2)}`;
  }
}
