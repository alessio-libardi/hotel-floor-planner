import { TestBed } from '@angular/core/testing';
import { By } from '@angular/platform-browser';
import { SeatingRoomRowComponent } from '../seating-room-row/seating-room-row.component';
import {
  SeatingFloorViewModel,
  SeatingRoomCheckChange,
  SeatingRoomViewModel,
} from '../../seating-page/seating-view-model';
import { SeatingFloorColumnComponent } from './seating-floor-column.component';

describe('SeatingFloorColumnComponent', () => {
  it('forwards room selection and semantic check changes', () => {
    const fixture = TestBed.createComponent(SeatingFloorColumnComponent);
    const floor: SeatingFloorViewModel = {
      id: 'floor-1',
      number: 1,
      rooms: [createRoom()],
    };
    fixture.componentRef.setInput('floor', floor);

    const selectedRooms: SeatingRoomViewModel[] = [];
    const checkChanges: SeatingRoomCheckChange[] = [];
    fixture.componentInstance.roomSelected.subscribe((room) =>
      selectedRooms.push(room)
    );
    fixture.componentInstance.roomCheckedChange.subscribe((change) =>
      checkChanges.push(change)
    );
    fixture.detectChanges();

    const roomRow = fixture.debugElement.query(
      By.directive(SeatingRoomRowComponent)
    ).componentInstance as SeatingRoomRowComponent;
    roomRow.selected.emit();
    roomRow.checkedChange.emit(true);

    expect(selectedRooms).toEqual([floor.rooms[0]]);
    expect(checkChanges).toEqual([{ roomId: 'room-100', checked: true }]);
  });

  it('renders an empty-floor state', () => {
    const fixture = TestBed.createComponent(SeatingFloorColumnComponent);
    fixture.componentRef.setInput('floor', {
      id: 'floor-1',
      number: 1,
      rooms: [],
    });
    fixture.detectChanges();

    expect(fixture.nativeElement.textContent).toContain('No rooms');
  });
});

function createRoom(): SeatingRoomViewModel {
  return {
    id: 'room-100',
    number: 100,
    note: null,
    checkedToday: false,
    departureStatus: 'none',
    tableNumber: null,
  };
}
