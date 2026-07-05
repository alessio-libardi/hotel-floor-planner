import { CommonModule } from '@angular/common';
import { Component, OnInit, inject } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';
import { MatDialog, MatDialogModule } from '@angular/material/dialog';
import { MatIconModule } from '@angular/material/icon';
import { MatListModule } from '@angular/material/list';
import { MatMenuModule } from '@angular/material/menu';
import { firstValueFrom } from 'rxjs';
import { FloorViewModel, RoomViewModel } from '../../floor.models';
import { FloorStore } from '../../floor.store';
import {
  SetupRoomDialogComponent,
  SetupRoomDialogResult,
} from './setup-room-dialog.component';

@Component({
  selector: 'app-setup-page',
  imports: [
    CommonModule,
    MatButtonModule,
    MatCardModule,
    MatDialogModule,
    MatIconModule,
    MatListModule,
    MatMenuModule,
  ],
  templateUrl: './setup-page.component.html',
  styleUrls: ['./setup-page.component.css'],
})
export class SetupPageComponent implements OnInit {
  protected readonly floors$;

  private readonly dialog = inject(MatDialog);

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

  protected floorLabel(floorNumber: number): string {
    return `${this.ordinal(floorNumber)} floor`;
  }

  protected roomRowBackground(room: RoomViewModel): string | null {
    const departureDate = room.departureDate;

    if (!departureDate) {
      return null;
    }

    const today = this.toDateString(this.today());
    const tomorrow = this.toDateString(this.tomorrow());

    if (departureDate === tomorrow) {
      return 'var(--mat-sys-tertiary-container)';
    }

    if (departureDate <= today) {
      return 'var(--mat-sys-error-container)';
    }

    return null;
  }

  protected roomRowForeground(room: RoomViewModel): string | null {
    const background = this.roomRowBackground(room);

    if (background === 'var(--mat-sys-error-container)') {
      return 'var(--mat-sys-on-error-container)';
    }

    if (background === 'var(--mat-sys-tertiary-container)') {
      return 'var(--mat-sys-on-tertiary-container)';
    }

    return null;
  }

  protected async openRoomDetails(
    floorId: string,
    room: RoomViewModel
  ): Promise<void> {
    const dialogRef = this.dialog.open<
      SetupRoomDialogComponent,
      {
        roomNumber: number;
        arrivalDate: string | null;
        departureDate: string | null;
      },
      SetupRoomDialogResult
    >(SetupRoomDialogComponent, {
      width: 'min(90vw, 640px)',
      minWidth: '480px',
      data: {
        roomNumber: room.number,
        arrivalDate: room.arrivalDate,
        departureDate: room.departureDate,
      },
    });

    const result = await firstValueFrom(dialogRef.afterClosed());

    if (!result) {
      return;
    }

    await this.floorStore.updateRoomDetails(floorId, room.id, {
      arrivalDate: result.arrivalDate,
      departureDate: result.departureDate,
    });
  }

  protected trackByFloor(_index: number, floor: FloorViewModel): string {
    return floor.id;
  }

  protected trackByRoom(_index: number, room: { id: string }): string {
    return room.id;
  }

  private ordinal(value: number): string {
    const mod10 = value % 10;
    const mod100 = value % 100;

    if (mod10 === 1 && mod100 !== 11) {
      return `${value}st`;
    }

    if (mod10 === 2 && mod100 !== 12) {
      return `${value}nd`;
    }

    if (mod10 === 3 && mod100 !== 13) {
      return `${value}rd`;
    }

    return `${value}th`;
  }

  private toDateOnly(value: string | null): Date | null {
    if (!value) {
      return null;
    }

    const [year, month, day] = value.split('-').map((entry) => Number(entry));

    if (!year || !month || !day) {
      return null;
    }

    const parsed = new Date(year, month - 1, day);
    parsed.setHours(0, 0, 0, 0);
    return parsed;
  }

  private toDateString(value: Date): string {
    const year = value.getFullYear();
    const month = `${value.getMonth() + 1}`.padStart(2, '0');
    const day = `${value.getDate()}`.padStart(2, '0');

    return `${year}-${month}-${day}`;
  }

  private tomorrow(): Date {
    const value = this.today();
    value.setDate(value.getDate() + 1);
    return value;
  }

  private today(): Date {
    const now = new Date();
    now.setHours(0, 0, 0, 0);
    return now;
  }
}
