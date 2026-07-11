import { CommonModule } from '@angular/common';
import { Component, inject, signal } from '@angular/core';
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
import { MatTabsModule } from '@angular/material/tabs';
import { FloorStore } from '../../floor.store';
import { PlanItem, PlanLayoutStore } from '../../plan-layout.store';
import {
  formatTableRoomLabel,
  normalizeRoomNumbers,
  primaryRoomNumber,
} from '../../room-assignment';
import { nextGeneratedTableNumber } from '../../table-number';

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

const SINGLE_LINKED_ROOM_COUNT = 1;

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
    MatTabsModule,
  ],
  templateUrl: './shape-detail-dialog.component.html',
  styleUrls: ['./shape-detail-dialog.component.css'],
})
export class ShapeDetailDialogComponent {
  protected readonly selectedItem: PlanItem;
  protected draftLabel = '';
  protected draftTableNumber = '';
  protected draftRoomNumbers: number[] = [];
  protected attemptedSubmit = false;
  protected isSaving = false;
  protected saveErrorMessage = '';
  protected readonly selectedTabIndex = signal(0);

  protected readonly stayRange = new FormGroup({
    start: new FormControl<Date | null>(null),
    end: new FormControl<Date | null>(null),
  });

  private readonly store = inject(PlanLayoutStore);
  private readonly floorStore = inject(FloorStore);
  private readonly dialogRef = inject(MatDialogRef<ShapeDetailDialogComponent>);
  protected readonly data = inject<ShapeDetailDialogData>(MAT_DIALOG_DATA);

  constructor() {
    this.selectedItem = {
      ...this.data.item,
      roomNumbers: [...this.data.item.roomNumbers],
      linkedTableIds: [...this.data.item.linkedTableIds],
    };

    this.draftLabel = this.selectedItem.text;
    this.draftTableNumber =
      this.selectedItem.tableNumber != null
        ? `${this.selectedItem.tableNumber}`
        : '';
    this.draftRoomNumbers = [...this.selectedItem.roomNumbers];
    this.setDateRangeFromSelectedRooms();
  }

  protected primaryFieldLabel(): string {
    return this.selectedItem.type === 'table' ? 'Table number' : 'Label';
  }

  protected primaryFieldPlaceholder(): string {
    return this.selectedItem.type === 'table'
      ? 'Enter a table number'
      : 'Enter a label';
  }

  protected primaryFieldType(): 'number' | 'text' {
    return 'text';
  }

  protected primaryFieldValue(): string {
    return this.selectedItem.type === 'table'
      ? this.draftTableNumber
      : this.draftLabel;
  }

  protected noteValue(): string {
    return this.draftLabel;
  }

  protected onPrimaryFieldInput(value: string): void {
    if (this.selectedItem.type === 'table') {
      this.draftTableNumber = value;
      return;
    }

    this.draftLabel = value;
  }

  protected onNoteInput(value: string): void {
    this.draftLabel = value;
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

    for (const room of this.availableRoomOptions()) {
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

  protected roomSelectionValue(): number[] {
    return this.draftRoomNumbers;
  }

  protected onRoomSelectionChange(roomNumbers: number[] | null): void {
    this.draftRoomNumbers = normalizeRoomNumbers(roomNumbers ?? []);
    this.selectedTabIndex.set(0);
    this.setDateRangeFromSelectedRooms();
  }

  protected onTabChange(index: number): void {
    this.selectedTabIndex.set(index);
  }

  protected roomTabLabel(roomNumber: number): string {
    const room = this.roomOptionByNumber(roomNumber);
    return room
      ? `Floor ${room.floorNumber} – Room ${room.roomNumber}`
      : `Room ${roomNumber}`;
  }

  protected roomArrivalDate(roomNumber: number): string {
    return this.roomOptionByNumber(roomNumber)?.arrivalDate ?? '—';
  }

  protected roomDepartureDate(roomNumber: number): string {
    return this.roomOptionByNumber(roomNumber)?.departureDate ?? '—';
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
    return (
      this.selectedItem.type === 'table' &&
      this.draftRoomNumbers.length === SINGLE_LINKED_ROOM_COUNT
    );
  }

  protected hasMultipleLinkedRooms(): boolean {
    return (
      this.selectedItem.type === 'table' && this.draftRoomNumbers.length > 1
    );
  }

  protected saveButtonDisabled(): boolean {
    return (
      this.hasInvalidDateRange() ||
      this.hasInvalidTableNumber() ||
      this.hasDuplicateTableNumber() ||
      this.isSaving
    );
  }

  protected async save(): Promise<void> {
    this.attemptedSubmit = true;
    this.saveErrorMessage = '';

    if (this.hasInvalidDateRange()) {
      return;
    }

    if (this.hasInvalidTableNumber() || this.hasDuplicateTableNumber()) {
      return;
    }

    this.isSaving = true;

    try {
      if (
        this.selectedItem.type !== 'table' &&
        this.draftLabel !== this.selectedItem.text
      ) {
        await this.store.updateItem(this.selectedItem.id, {
          text: this.draftLabel,
        });
      }

      if (this.selectedItem.type === 'table') {
        const tableNumber = this.parsedDraftTableNumber();

        if (
          tableNumber != null &&
          tableNumber !== this.selectedItem.tableNumber
        ) {
          await this.store.updateItem(this.selectedItem.id, {
            tableNumber,
          });
        }

        if (this.draftLabel !== this.selectedItem.text) {
          await this.store.updateItem(this.selectedItem.id, {
            text: this.draftLabel,
          });
        }

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
    if (
      this.selectedItem.type !== 'table' ||
      this.draftRoomNumbers.length === 0
    ) {
      return 'No room linked';
    }

    if (this.draftRoomNumbers.length > 1) {
      return formatTableRoomLabel(this.draftRoomNumbers);
    }

    const room = this.roomOptionByNumber(this.draftRoomNumbers[0]);
    return room
      ? `Floor ${room.floorNumber} - Room ${room.roomNumber}`
      : 'Linked room not found';
  }

  protected hasInvalidTableNumber(): boolean {
    return (
      this.selectedItem.type === 'table' &&
      this.parsedDraftTableNumber() == null
    );
  }

  protected hasDuplicateTableNumber(): boolean {
    if (this.selectedItem.type !== 'table') {
      return false;
    }

    const tableNumber = this.parsedDraftTableNumber();
    if (tableNumber == null) {
      return false;
    }

    return this.store.items.some(
      (item) =>
        item.type === 'table' &&
        item.id !== this.selectedItem.id &&
        item.tableNumber === tableNumber
    );
  }

  protected async resetTable(): Promise<void> {
    if (this.selectedItem.type !== 'table' || this.isSaving) {
      return;
    }

    this.isSaving = true;
    this.saveErrorMessage = '';

    try {
      const currentTable =
        this.store.items.find((item) => item.id === this.selectedItem.id) ??
        this.selectedItem;

      await this.clearRoomDates(currentTable.roomNumbers);
      await this.unlinkTable(currentTable);

      const resetTableNumber =
        currentTable.linkedTableIds.length > 0
          ? nextGeneratedTableNumber(
              this.store.items
                .filter(
                  (item) => item.type === 'table' && item.id !== currentTable.id
                )
                .map((item) => item.tableNumber)
            )
          : currentTable.tableNumber;

      await this.store.updateItem(currentTable.id, {
        linkedTableIds: [],
        roomNumber: null,
        roomNumbers: [],
        text: '',
        tableNumber: resetTableNumber,
      });

      this.dialogRef.close({ reset: true });
    } catch {
      this.saveErrorMessage =
        'Unable to reset this table right now. Please try again.';
    } finally {
      this.isSaving = false;
    }
  }

  private async persistTableRoomAssignment(): Promise<void> {
    const roomNumbers = normalizeRoomNumbers(this.draftRoomNumbers);
    const nextRoomNumberSet = new Set(roomNumbers);

    if (this.hasSameRoomNumbers(roomNumbers, this.selectedItem.roomNumbers)) {
      return;
    }

    const conflictingTables = this.store.items.filter(
      (item) =>
        item.type === 'table' &&
        item.id !== this.selectedItem.id &&
        item.roomNumbers.some((roomNumber) => nextRoomNumberSet.has(roomNumber))
    );

    await Promise.all(
      conflictingTables.map(async (table) => {
        const nextRoomNumbers = table.roomNumbers.filter(
          (roomNumber) => !nextRoomNumberSet.has(roomNumber)
        );

        await this.store.updateItem(table.id, {
          roomNumber: primaryRoomNumber(nextRoomNumbers),
          roomNumbers: nextRoomNumbers,
        });
      })
    );

    await this.store.updateItem(this.selectedItem.id, {
      roomNumber: primaryRoomNumber(roomNumbers),
      roomNumbers,
    });
  }

  private async persistRoomDateRange(): Promise<void> {
    if (this.draftRoomNumbers.length !== 1) {
      return;
    }

    const selectedRoom = this.roomOptionByNumber(this.draftRoomNumbers[0]);
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

  private async clearRoomDates(roomNumbers: number[]): Promise<void> {
    if (roomNumbers.length === 0) {
      return;
    }

    await Promise.all(
      roomNumbers.map(async (roomNumber) => {
        const room = this.roomOptionByNumber(roomNumber);
        if (!room) {
          return;
        }

        if (room.arrivalDate == null && room.departureDate == null) {
          return;
        }

        await this.floorStore.updateRoomDetails(room.floorId, room.roomId, {
          arrivalDate: null,
          departureDate: null,
        });
      })
    );
  }

  private async unlinkTable(table: PlanItem): Promise<void> {
    if (table.linkedTableIds.length === 0) {
      return;
    }

    await Promise.all(
      table.linkedTableIds.map(async (linkedTableId) => {
        const linkedTable = this.store.items.find(
          (item) => item.id === linkedTableId && item.type === 'table'
        );

        if (!linkedTable) {
          return;
        }

        await this.store.updateItem(linkedTable.id, {
          linkedTableIds: linkedTable.linkedTableIds.filter(
            (entry) => entry !== table.id
          ),
        });
      })
    );
  }

  private roomOptionByNumber(
    roomNumber: number
  ): ShapeDetailRoomOption | undefined {
    return this.data.roomOptions.find((room) => room.roomNumber === roomNumber);
  }

  private availableRoomOptions(): ShapeDetailRoomOption[] {
    const selectedRoomNumbers = new Set(this.draftRoomNumbers);
    const assignedRoomNumbers = new Set(
      this.store.items
        .filter(
          (item) => item.type === 'table' && item.id !== this.selectedItem.id
        )
        .flatMap((item) => item.roomNumbers)
    );

    return this.data.roomOptions.filter(
      (room) =>
        selectedRoomNumbers.has(room.roomNumber) ||
        !assignedRoomNumbers.has(room.roomNumber)
    );
  }

  private setDateRangeFromSelectedRooms(): void {
    const room =
      this.draftRoomNumbers.length === SINGLE_LINKED_ROOM_COUNT
        ? this.roomOptionByNumber(this.draftRoomNumbers[0])
        : undefined;

    this.stayRange.controls.start.setValue(
      this.toDateOnly(room?.arrivalDate ?? null)
    );
    this.stayRange.controls.end.setValue(
      this.toDateOnly(room?.departureDate ?? null)
    );
  }

  private hasSameRoomNumbers(left: number[], right: number[]): boolean {
    if (left.length !== right.length) {
      return false;
    }

    const rightSet = new Set(right);
    return left.every((roomNumber) => rightSet.has(roomNumber));
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

  private parsedDraftTableNumber(): string | null {
    const trimmed = this.draftTableNumber.trim();

    if (!trimmed) {
      return null;
    }

    return trimmed;
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
