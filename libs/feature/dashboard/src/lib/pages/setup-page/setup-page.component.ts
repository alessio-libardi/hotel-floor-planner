import { CommonModule } from '@angular/common';
import { Component, OnInit, inject } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';
import { MatDialog, MatDialogModule } from '@angular/material/dialog';
import { MatIconModule } from '@angular/material/icon';
import { MatListModule } from '@angular/material/list';
import { firstValueFrom } from 'rxjs';
import { FloorViewModel, RoomViewModel } from '../../floor.models';
import { FloorStore } from '../../floor.store';
import {
  getRoomDepartureStatus,
  TOMORROW_HIGHLIGHT_BACKGROUND,
  TOMORROW_HIGHLIGHT_FOREGROUND,
} from '../../room-departure-status';
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
    const status = getRoomDepartureStatus(room.departureDate);

    if (status === 'tomorrow') {
      return TOMORROW_HIGHLIGHT_BACKGROUND;
    }

    if (status === 'expired') {
      return 'var(--mat-sys-error-container)';
    }

    return null;
  }

  protected roomRowForeground(room: RoomViewModel): string | null {
    const status = getRoomDepartureStatus(room.departureDate);

    if (status === 'expired') {
      return 'var(--mat-sys-on-error-container)';
    }

    if (status === 'tomorrow') {
      return TOMORROW_HIGHLIGHT_FOREGROUND;
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

    if (result.deleteRoom) {
      await this.floorStore.removeRoom(floorId, room.id);
      return;
    }

    await this.floorStore.updateRoomDetails(floorId, room.id, {
      arrivalDate: result.arrivalDate,
      departureDate: result.departureDate,
      note: room.note,
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
}
