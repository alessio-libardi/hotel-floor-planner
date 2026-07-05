import { CommonModule } from '@angular/common';
import { Component, inject } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatNativeDateModule } from '@angular/material/core';
import { MatDatepickerModule } from '@angular/material/datepicker';
import {
  MAT_DIALOG_DATA,
  MatDialogModule,
  MatDialogRef,
} from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { FormControl, FormGroup, ReactiveFormsModule } from '@angular/forms';

export interface SetupRoomDialogData {
  roomNumber: number;
  arrivalDate: string | null;
  departureDate: string | null;
}

export interface SetupRoomDialogResult {
  arrivalDate: string | null;
  departureDate: string | null;
}

@Component({
  selector: 'app-setup-room-dialog',
  imports: [
    CommonModule,
    ReactiveFormsModule,
    MatDialogModule,
    MatButtonModule,
    MatFormFieldModule,
    MatDatepickerModule,
    MatNativeDateModule,
    MatInputModule,
  ],
  templateUrl: './setup-room-dialog.component.html',
  styleUrls: ['./setup-room-dialog.component.css'],
})
export class SetupRoomDialogComponent {
  private readonly dialogRef = inject(
    MatDialogRef<SetupRoomDialogComponent, SetupRoomDialogResult>
  );

  protected readonly data = inject<SetupRoomDialogData>(MAT_DIALOG_DATA);
  protected readonly stayRange = new FormGroup({
    start: new FormControl<Date | null>(this.toDateOnly(this.data.arrivalDate)),
    end: new FormControl<Date | null>(this.toDateOnly(this.data.departureDate)),
  });

  protected close(): void {
    this.dialogRef.close();
  }

  protected save(): void {
    const start = this.stayRange.controls.start.value;
    const end = this.stayRange.controls.end.value;

    this.dialogRef.close({
      arrivalDate: this.formatDateOnly(start),
      departureDate: this.formatDateOnly(end),
    });
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
