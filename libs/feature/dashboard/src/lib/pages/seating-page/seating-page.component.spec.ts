import { TestBed } from '@angular/core/testing';
import { MatDialog } from '@angular/material/dialog';
import { By } from '@angular/platform-browser';
import { of } from 'rxjs';
import { FloorStore } from '../../floor.store';
import { PlanItem, PlanLayoutStore } from '../../plan-layout.store';
import { SeatingFloorColumnComponent } from '../components/seating-floor-column/seating-floor-column.component';
import { SeatingRoomNoteDialogComponent } from '../components/seating-room-note-dialog/seating-room-note-dialog.component';
import { SeatingPageComponent } from './seating-page.component';

vi.mock('../../floor-planner.api', () => ({
  FloorPlannerApi: class FloorPlannerApi {},
}));

describe('SeatingPageComponent', () => {
  const markRoomCheckedToday = vi.fn(() => Promise.resolve());
  const clearRoomCheckedToday = vi.fn(() => Promise.resolve());
  const openDialog = vi.fn();

  beforeEach(() => {
    markRoomCheckedToday.mockClear();
    clearRoomCheckedToday.mockClear();
    openDialog.mockClear();

    TestBed.configureTestingModule({
      imports: [SeatingPageComponent],
      providers: [
        {
          provide: FloorStore,
          useValue: {
            ensureLoaded: () => Promise.resolve(),
            floors$: of([
              {
                id: 'floor-1',
                number: 1,
                rooms: [
                  {
                    id: 'room-100',
                    label: 'Room 100',
                    number: 100,
                    arrivalDate: null,
                    departureDate: null,
                    checkedDate: null,
                    note: 'Window seat',
                  },
                ],
              },
            ]),
            markRoomCheckedToday,
            clearRoomCheckedToday,
          },
        },
        {
          provide: PlanLayoutStore,
          useValue: { items$: of([createTable()]) },
        },
        {
          provide: MatDialog,
          useValue: { open: openDialog },
        },
      ],
    });
  });

  it('opens room notes and sends semantic check changes to the store', async () => {
    const fixture = TestBed.createComponent(SeatingPageComponent);
    fixture.detectChanges();
    await Promise.resolve();
    await Promise.resolve();
    fixture.detectChanges();

    const floor = fixture.debugElement.query(
      By.directive(SeatingFloorColumnComponent)
    ).componentInstance as SeatingFloorColumnComponent;
    const room = floor.floor().rooms[0];

    floor.roomSelected.emit(room);
    floor.roomCheckedChange.emit({ roomId: room.id, checked: true });
    floor.roomCheckedChange.emit({ roomId: room.id, checked: false });

    expect(openDialog).toHaveBeenCalledWith(SeatingRoomNoteDialogComponent, {
      width: 'min(90vw, 420px)',
      data: { roomNumber: 100, note: 'Window seat' },
    });
    expect(markRoomCheckedToday).toHaveBeenCalledWith('room-100');
    expect(clearRoomCheckedToday).toHaveBeenCalledWith('room-100');
    expect(room.tableNumber).toBe('4');
  });

  it('prints from the page action', async () => {
    const print = vi.spyOn(window, 'print').mockImplementation(() => undefined);
    const fixture = TestBed.createComponent(SeatingPageComponent);
    fixture.detectChanges();
    await Promise.resolve();
    await Promise.resolve();
    fixture.detectChanges();

    const printButton = fixture.nativeElement.querySelector(
      '[aria-label="Print seating page"]'
    ) as HTMLButtonElement;
    printButton.click();

    expect(print).toHaveBeenCalledOnce();
  });
});

function createTable(): PlanItem {
  return {
    id: 'table-4',
    type: 'table',
    x: 0,
    y: 0,
    width: 96,
    height: 72,
    text: '',
    tableNumber: '4',
    displayTableNumber: '4',
    roomNumber: 100,
    roomNumbers: [100],
    linkedTableIds: [],
    isTableNumberAnchor: true,
  };
}
