import { TestBed } from '@angular/core/testing';
import {
  DOUBLE_CLICK_DELAY_MS,
  SeatingRoomRowComponent,
} from './seating-room-row.component';
import { SeatingRoomViewModel } from '../../seating-page/seating-view-model';

describe('SeatingRoomRowComponent', () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it('opens room details only after a single-click delay', () => {
    vi.useFakeTimers();
    const fixture = createFixture(false);
    let selections = 0;
    fixture.componentInstance.selected.subscribe(() => selections++);

    getRoomButton(fixture.nativeElement).click();
    vi.advanceTimersByTime(DOUBLE_CLICK_DELAY_MS - 1);
    expect(selections).toBe(0);

    vi.advanceTimersByTime(1);
    expect(selections).toBe(1);
  });

  it('double-clicks to check without opening room details', () => {
    vi.useFakeTimers();
    const fixture = createFixture(false);
    const checkedChanges: boolean[] = [];
    let selections = 0;
    fixture.componentInstance.checkedChange.subscribe((checked) =>
      checkedChanges.push(checked)
    );
    fixture.componentInstance.selected.subscribe(() => selections++);

    const button = getRoomButton(fixture.nativeElement);
    button.click();
    const secondClick = new MouseEvent('click', { cancelable: true });
    button.dispatchEvent(secondClick);
    vi.advanceTimersByTime(DOUBLE_CLICK_DELAY_MS);

    expect(checkedChanges).toEqual([true]);
    expect(selections).toBe(0);
    expect(secondClick.defaultPrevented).toBe(true);
  });

  it('double-clicks an already checked room to uncheck it', () => {
    vi.useFakeTimers();
    const fixture = createFixture(true);
    const checkedChanges: boolean[] = [];
    fixture.componentInstance.checkedChange.subscribe((checked) =>
      checkedChanges.push(checked)
    );

    const button = getRoomButton(fixture.nativeElement);
    button.click();
    button.click();

    expect(checkedChanges).toEqual([false]);
  });

  it('cancels a pending room selection when destroyed', () => {
    vi.useFakeTimers();
    const fixture = createFixture(false);
    let selections = 0;
    fixture.componentInstance.selected.subscribe(() => selections++);

    getRoomButton(fixture.nativeElement).click();
    fixture.destroy();
    vi.advanceTimersByTime(DOUBLE_CLICK_DELAY_MS);

    expect(selections).toBe(0);
  });
});

function createFixture(checkedToday: boolean) {
  const fixture = TestBed.createComponent(SeatingRoomRowComponent);
  fixture.componentRef.setInput('room', createRoom(checkedToday));
  fixture.detectChanges();
  return fixture;
}

function getRoomButton(element: HTMLElement): HTMLButtonElement {
  return element.querySelector('button') as HTMLButtonElement;
}

function createRoom(checkedToday: boolean): SeatingRoomViewModel {
  return {
    id: 'room-100',
    number: 100,
    note: 'Window seat',
    checkedToday,
    departureStatus: 'none',
    tableNumber: '4',
  };
}
