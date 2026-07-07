import { CommonModule } from '@angular/common';
import { Component, inject } from '@angular/core';
import { FormControl, FormGroup, ReactiveFormsModule } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatNativeDateModule } from '@angular/material/core';
import { MatDatepickerModule } from '@angular/material/datepicker';
import {
  MAT_DIALOG_DATA,
  MatDialogModule,
  MatDialogRef,
} from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { FloorStore } from '../../floor.store';
import { PlanItem, PlanLayoutStore } from '../../plan-layout.store';

export interface ShapeDetailRoomOption {
  floorId: string;
  floorNumber: number;
  roomId: string;
  roomNumber: number;
  arrivalDate: string | null;
  departureDate: string | null;
}
export interface ShapeDetailDialogData {
  item: PlanItem;
  roomOptions: ShapeDetailRoomOption[];
}

@Component({
  selector: 'app-shape-detail-dialog',
  imports: [
    CommonModule,
    ReactiveFormsModule,
    MatDialogModule,
    MatButtonModule,
    MatFormFieldModule,
    MatDatepickerModule,
    MatNativeDateModule,
    MatIconModule,
    MatInputModule,
    MatSelectModule,
  ],
  templateUrl: './shape-detail-dialog.component.html',
  styleUrls: ['./shape-detail-dialog.component.css'],
})
export class ShapeDetailDialogComponent {
  protected readonly selectedItem: PlanItem;
  protected draftLabel = '';
  protected draftRoomNumber: number | null = null;
  protected attemptedSubmit = false;
  protected isSaving = false;
  protected saveErrorMessage = '';

  protected readonly stayRange = new FormGroup({
    start: new FormControl<Date | null>(null),
    end: new FormControl<Date | null>(null),
  });

  private readonly store = inject(PlanLayoutStore);
  private readonly floorStore = inject(FloorStore);
  private readonly dialogRef = inject(MatDialogRef<ShapeDetailDialogComponent>);
  protected readonly data = inject<ShapeDetailDialogData>(MAT_DIALOG_DATA);

  constructor() {
    this.selectedItem = { ...this.data.item };

    this.draftLabel = this.selectedItem.text;
    this.draftRoomNumber = this.selectedItem.roomNumber;
    this.setDateRangeFromRoom(this.draftRoomNumber);
  }

  protected close(): void {
    this.dialogRef.close();
  }

  protected async deleteSelected(): Promise<void> {
    await this.store.deleteItem(this.selectedItem.id);
    this.dialogRef.close({ deleted: true });
  }

  protected groupedRooms(): Array<{
    floorNumber: number;
    rooms: ShapeDetailRoomOption[];
  }> {
    const grouped = new Map<number, ShapeDetailRoomOption[]>();

    for (const room of this.data.roomOptions) {
      const existing = grouped.get(room.floorNumber);
      if (existing) {
        existing.push(room);
      } else {
        grouped.set(room.floorNumber, [room]);
      }
    }

    return [...grouped.entries()]
      .sort((left, right) => left[0] - right[0])
      .map(([floorNumber, rooms]) => ({
        floorNumber,
        rooms: [...rooms].sort(
          (left, right) => left.roomNumber - right.roomNumber
        ),
      }));
  }

  protected roomSelectionValue(): number | '' {
    return this.draftRoomNumber ?? '';
  }

  protected onRoomSelectionChange(roomNumberValue: string): void {
    const roomNumber = roomNumberValue ? Number(roomNumberValue) : null;
    this.draftRoomNumber = Number.isNaN(roomNumber) ? null : roomNumber;
    this.setDateRangeFromRoom(this.draftRoomNumber);
  }

  protected hasInvalidDateRange(): boolean {
    const start = this.stayRange.controls.start.value;
    const end = this.stayRange.controls.end.value;

    if (!start || !end) {
      return false;
    }

    const startDate = this.formatDateOnly(start);
    const endDate = this.formatDateOnly(end);

    if (!startDate || !endDate) {
      return false;
    }

    return endDate < startDate;
  }

  protected canEditRoomDates(): boolean {
    return this.selectedItem.type === 'table' && this.draftRoomNumber != null;
  }

  protected saveButtonDisabled(): boolean {
    return this.hasInvalidDateRange() || this.isSaving;
  }

  protected async save(): Promise<void> {
    this.attemptedSubmit = true;
    this.saveErrorMessage = '';

    if (this.hasInvalidDateRange()) {
      return;
    }

    this.isSaving = true;

    try {
      if (this.draftLabel !== this.selectedItem.text) {
        await this.store.updateItem(this.selectedItem.id, {
          text: this.draftLabel,
        });
      }

      if (this.selectedItem.type === 'table') {
        await this.persistTableRoomAssignment();
        await this.persistRoomDateRange();
      }

      this.dialogRef.close({ saved: true });
    } catch {
      this.saveErrorMessage =
        'Unable to save changes right now. Please try again.';
    } finally {
      this.isSaving = false;
    }
  }

  protected linkedRoomSummary(): string {
    if (this.selectedItem.type !== 'table' || this.draftRoomNumber == null) {
      return 'No room linked';
    }

    const room = this.roomOptionByNumber(this.draftRoomNumber);
    return room
      ? `Floor ${room.floorNumber} - Room ${room.roomNumber}`
      : 'Linked room not found';
  }

  private async persistTableRoomAssignment(): Promise<void> {
    const roomNumber = this.draftRoomNumber;

    if (roomNumber === this.selectedItem.roomNumber) {
      return;
    }

    const existing = roomNumber
      ? this.store.items.find(
          (item) =>
            item.type === 'table' &&
            item.id !== this.selectedItem.id &&
            item.roomNumber === roomNumber
        )
      : undefined;

    if (existing) {
      await this.store.updateItem(existing.id, { roomNumber: null });
    }

    await this.store.updateItem(this.selectedItem.id, {
      roomNumber,
    });
  }

  private async persistRoomDateRange(): Promise<void> {
    if (this.draftRoomNumber == null) {
      return;
    }

    const selectedRoom = this.roomOptionByNumber(this.draftRoomNumber);
    if (!selectedRoom) {
      return;
    }

    const arrivalDate = this.formatDateOnly(
      this.stayRange.controls.start.value
    );
    const departureDate = this.formatDateOnly(
      this.stayRange.controls.end.value
    );

    if (
      arrivalDate === selectedRoom.arrivalDate &&
      departureDate === selectedRoom.departureDate
    ) {
      return;
    }

    await this.floorStore.updateRoomDetails(
      selectedRoom.floorId,
      selectedRoom.roomId,
      {
        arrivalDate,
        departureDate,
      }
    );
  }

  private roomOptionByNumber(
    roomNumber: number
  ): ShapeDetailRoomOption | undefined {
    return this.data.roomOptions.find((room) => room.roomNumber === roomNumber);
  }

  private setDateRangeFromRoom(roomNumber: number | null): void {
    const room =
      roomNumber == null ? undefined : this.roomOptionByNumber(roomNumber);

    this.stayRange.controls.start.setValue(
      this.toDateOnly(room?.arrivalDate ?? null)
    );
    this.stayRange.controls.end.setValue(
      this.toDateOnly(room?.departureDate ?? null)
    );
  }

  private formatDateOnly(value: Date | null): string | null {
    if (!value) {
      return null;
    }

    const year = value.getFullYear();
    const month = `${value.getMonth() + 1}`.padStart(2, '0');
    const day = `${value.getDate()}`.padStart(2, '0');

    return `${year}-${month}-${day}`;
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
}
