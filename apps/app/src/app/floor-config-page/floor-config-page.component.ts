import { CommonModule } from '@angular/common';
import { Component, OnInit } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { FloorViewModel, RoomViewModel } from '../floor.models';
import { FloorStore } from '../floor.store';

@Component({
  selector: 'app-floor-config-page',
  imports: [
    CommonModule,
    MatButtonModule,
    MatCardModule,
    MatFormFieldModule,
    MatIconModule,
    MatInputModule,
  ],
  templateUrl: './floor-config-page.component.html',
  styleUrl: './floor-config-page.component.css',
})
export class FloorConfigPageComponent implements OnInit {
  protected readonly floors$;
  protected roomDetailsModal: {
    floorId: string;
    roomId: string;
    roomNumber: number;
    arrivalDate: string;
    departureDate: string;
  } | null = null;

  constructor(private readonly floorStore: FloorStore) {
    this.floors$ = this.floorStore.floors$;
  }

  async ngOnInit(): Promise<void> {
    await this.floorStore.ensureLoaded();
  }

  async addFloor(): Promise<void> {
    await this.floorStore.addFloor();
  }

  async removeFloor(floorId: string): Promise<void> {
    await this.floorStore.removeFloor(floorId);
  }

  async addRoom(floorId: string): Promise<void> {
    await this.floorStore.addRoom(floorId);
  }

  async removeRoom(floorId: string, roomId: string): Promise<void> {
    await this.floorStore.removeRoom(floorId, roomId);
  }

  protected openRoomDetails(floorId: string, room: RoomViewModel): void {
    this.roomDetailsModal = {
      floorId,
      roomId: room.id,
      roomNumber: room.number,
      arrivalDate: room.arrivalDate ?? '',
      departureDate: room.departureDate ?? '',
    };
  }

  protected closeRoomDetails(): void {
    this.roomDetailsModal = null;
  }

  protected async saveRoomDetails(
    arrivalDateValue: string,
    departureDateValue: string
  ): Promise<void> {
    if (!this.roomDetailsModal) {
      return;
    }

    const { floorId, roomId } = this.roomDetailsModal;
    const arrivalDate = arrivalDateValue || null;
    const departureDate = departureDateValue || null;

    await this.floorStore.updateRoomDetails(floorId, roomId, {
      arrivalDate,
      departureDate,
    });

    this.roomDetailsModal = null;
  }

  protected roomDateRange(room: RoomViewModel): string {
    if (room.arrivalDate && room.departureDate) {
      return `${room.arrivalDate} to ${room.departureDate}`;
    }

    if (room.arrivalDate) {
      return `Arrives ${room.arrivalDate}`;
    }

    if (room.departureDate) {
      return `Leaves ${room.departureDate}`;
    }

    return 'No stay dates';
  }

  protected roomCount(floors: FloorViewModel[]): number {
    return floors.reduce((count, floor) => count + floor.rooms.length, 0);
  }

  protected trackByFloor(_index: number, floor: FloorViewModel): string {
    return floor.id;
  }

  protected trackByRoom(_index: number, room: { id: string }): string {
    return room.id;
  }
}
