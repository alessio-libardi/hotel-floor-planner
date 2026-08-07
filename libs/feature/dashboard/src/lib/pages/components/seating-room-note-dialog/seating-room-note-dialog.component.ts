import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MAT_DIALOG_DATA, MatDialogModule } from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';

export interface SeatingRoomNoteDialogData {
  readonly roomNumber: number;
  readonly note: string | null;
}

@Component({
  selector: 'lib-seating-room-note-dialog',
  imports: [
    MatButtonModule,
    MatDialogModule,
    MatFormFieldModule,
    MatInputModule,
  ],
  templateUrl: './seating-room-note-dialog.component.html',
  styleUrls: ['./seating-room-note-dialog.component.css'],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class SeatingRoomNoteDialogComponent {
  protected readonly data = inject<SeatingRoomNoteDialogData>(MAT_DIALOG_DATA);
  protected readonly note = this.data.note?.trim() ?? '';
}
