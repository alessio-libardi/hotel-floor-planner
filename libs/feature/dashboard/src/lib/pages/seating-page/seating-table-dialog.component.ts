import { CommonModule } from '@angular/common';
import { Component, inject } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import {
  MAT_DIALOG_DATA,
  MatDialogModule,
  MatDialogRef,
} from '@angular/material/dialog';

export interface SeatingTableDialogData {
  roomNumber: number;
  note: string | null;
}

@Component({
  selector: 'app-seating-table-dialog',
  imports: [
    CommonModule,
    MatDialogModule,
    MatButtonModule,
    MatFormFieldModule,
    MatInputModule,
  ],
  templateUrl: './seating-table-dialog.component.html',
  styleUrls: ['./seating-table-dialog.component.css'],
})
export class SeatingTableDialogComponent {
  private readonly dialogRef = inject(
    MatDialogRef<SeatingTableDialogComponent>
  );

  protected readonly data = inject<SeatingTableDialogData>(MAT_DIALOG_DATA);

  protected readonly note = this.data.note?.trim() ?? '';

  protected close(): void {
    this.dialogRef.close();
  }
}
