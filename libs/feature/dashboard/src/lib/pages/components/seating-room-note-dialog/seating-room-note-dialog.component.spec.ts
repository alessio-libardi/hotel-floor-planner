import { TestBed } from '@angular/core/testing';
import { MAT_DIALOG_DATA } from '@angular/material/dialog';
import {
  SeatingRoomNoteDialogComponent,
  SeatingRoomNoteDialogData,
} from './seating-room-note-dialog.component';

describe('SeatingRoomNoteDialogComponent', () => {
  it.each([
    { source: 'Window seat', expected: 'Window seat' },
    { source: null, expected: '' },
    { source: '   ', expected: '' },
  ])('renders a read-only note from $source', ({ source, expected }) => {
    TestBed.configureTestingModule({
      imports: [SeatingRoomNoteDialogComponent],
      providers: [
        {
          provide: MAT_DIALOG_DATA,
          useValue: {
            roomNumber: 100,
            note: source,
          } satisfies SeatingRoomNoteDialogData,
        },
      ],
    });
    const fixture = TestBed.createComponent(SeatingRoomNoteDialogComponent);
    fixture.detectChanges();

    const note = fixture.nativeElement.querySelector(
      'textarea'
    ) as HTMLTextAreaElement;
    expect(note.value).toBe(expected);
    expect(note.readOnly).toBe(true);
  });
});
