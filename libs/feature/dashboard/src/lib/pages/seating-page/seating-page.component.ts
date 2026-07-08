import { CommonModule } from '@angular/common';
import { Component, inject } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';
import { MatDialog, MatDialogModule } from '@angular/material/dialog';
import { MatIconModule } from '@angular/material/icon';
import { MatListModule } from '@angular/material/list';
import {
  combineLatest,
  defer,
  from,
  map,
  Observable,
  startWith,
  shareReplay,
  switchMap,
  timer,
} from 'rxjs';
import { FloorViewModel } from '../../floor.models';
import { FloorStore } from '../../floor.store';
import { PlanLayoutStore } from '../../plan-layout.store';
import {
  getRoomDepartureStatus,
  TOMORROW_HIGHLIGHT_BACKGROUND,
  TOMORROW_HIGHLIGHT_FOREGROUND,
} from '../../room-departure-status';
import { SeatingTableDialogComponent } from './seating-table-dialog.component';

interface RoomTableAssignment {
  tableNumber: string;
  note: string;
}

interface RoomSwipeState {
  startX: number;
  startY: number;
}

interface SeatingViewModel {
  floors: FloorViewModel[];
  roomToTableMap: Map<number, RoomTableAssignment>;
  today: string;
}

const DAY_IN_MILLISECONDS = 24 * 60 * 60 * 1000;
const SWIPE_LEFT_THRESHOLD = 48;

@Component({
  selector: 'app-seating-page',
  imports: [
    CommonModule,
    MatButtonModule,
    MatCardModule,
    MatDialogModule,
    MatIconModule,
    MatListModule,
  ],
  templateUrl: './seating-page.component.html',
  styleUrls: ['./seating-page.component.css'],
})
export class SeatingPageComponent {
  private readonly floorStore = inject(FloorStore);
  private readonly planStore = inject(PlanLayoutStore);
  private readonly dialog = inject(MatDialog);
  private readonly roomSwipeState = new Map<string, RoomSwipeState>();
  private readonly swipeClickSuppression = new Map<string, number>();

  protected readonly floors$: Observable<FloorViewModel[]> = defer(() =>
    from(this.floorStore.ensureLoaded()).pipe(
      switchMap(() => this.floorStore.floors$)
    )
  ).pipe(shareReplay(1));

  protected readonly today$ = timer(
    this.msUntilTomorrow(),
    DAY_IN_MILLISECONDS
  ).pipe(
    map(() => this.formatDateOnly(new Date())),
    startWith(this.formatDateOnly(new Date())),
    shareReplay(1)
  );

  protected readonly roomToTableMap$ = this.planStore.items$.pipe(
    map((items) => {
      const roomToTableMap = new Map<number, RoomTableAssignment>();

      for (const item of items) {
        if (
          item.type !== 'table' ||
          item.roomNumber == null ||
          item.tableNumber == null
        ) {
          continue;
        }

        roomToTableMap.set(item.roomNumber, {
          tableNumber: item.tableNumber,
          note: item.text,
        });
      }

      return roomToTableMap;
    }),
    shareReplay(1)
  );

  protected readonly vm$: Observable<SeatingViewModel> = combineLatest({
    floors: this.floors$,
    roomToTableMap: this.roomToTableMap$,
    today: this.today$,
  });

  protected trackByFloor(_index: number, floor: FloorViewModel): string {
    return floor.id;
  }

  protected trackByRoom(_index: number, room: { id: string }): string {
    return room.id;
  }

  protected openTableDetails(roomNumber: number, note: string | null): void {
    this.dialog.open(SeatingTableDialogComponent, {
      width: 'min(90vw, 420px)',
      data: {
        roomNumber,
        note,
      },
    });
  }

  protected handleRoomPointerDown(roomId: string, event: PointerEvent): void {
    this.roomSwipeState.set(roomId, {
      startX: event.clientX,
      startY: event.clientY,
    });
  }

  protected handleRoomPointerUp(roomId: string, event: PointerEvent): void {
    const start = this.roomSwipeState.get(roomId);
    this.roomSwipeState.delete(roomId);

    if (!start) {
      return;
    }

    const deltaX = event.clientX - start.startX;
    const deltaY = event.clientY - start.startY;

    if (deltaX < -SWIPE_LEFT_THRESHOLD && Math.abs(deltaX) > Math.abs(deltaY)) {
      this.swipeClickSuppression.set(roomId, Date.now());
      void this.floorStore.markRoomCheckedToday(roomId);
    }
  }

  protected handleRoomPointerCancel(roomId: string): void {
    this.roomSwipeState.delete(roomId);
  }

  protected handleRoomClick(
    roomId: string,
    roomNumber: number,
    note: string | null,
    event: MouseEvent
  ): void {
    const suppressedAt = this.swipeClickSuppression.get(roomId);

    if (suppressedAt != null && Date.now() - suppressedAt < 500) {
      this.swipeClickSuppression.delete(roomId);
      event.preventDefault();
      event.stopPropagation();
      return;
    }

    this.swipeClickSuppression.delete(roomId);

    this.openTableDetails(roomNumber, note);
  }

  protected tableNumberForRoom(
    roomToTableMap: Map<number, RoomTableAssignment>,
    roomNumber: number
  ): string | null {
    return roomToTableMap.get(roomNumber)?.tableNumber ?? null;
  }

  protected noteForRoom(
    roomToTableMap: Map<number, RoomTableAssignment>,
    roomNumber: number
  ): string | null {
    return roomToTableMap.get(roomNumber)?.note ?? null;
  }

  protected isCheckedToday(checkedDate: string | null, today: string): boolean {
    return checkedDate === today;
  }

  protected roomRowBackground(departureDate: string | null): string | null {
    const status = getRoomDepartureStatus(departureDate);

    if (status === 'tomorrow') {
      return TOMORROW_HIGHLIGHT_BACKGROUND;
    }

    if (status === 'expired') {
      return 'var(--mat-sys-error-container)';
    }

    return null;
  }

  protected roomRowForeground(departureDate: string | null): string | null {
    const status = getRoomDepartureStatus(departureDate);

    if (status === 'tomorrow') {
      return TOMORROW_HIGHLIGHT_FOREGROUND;
    }

    if (status === 'expired') {
      return 'var(--mat-sys-on-error-container)';
    }

    return null;
  }

  private formatDateOnly(value: Date): string {
    const year = value.getFullYear();
    const month = `${value.getMonth() + 1}`.padStart(2, '0');
    const day = `${value.getDate()}`.padStart(2, '0');

    return `${year}-${month}-${day}`;
  }

  private msUntilTomorrow(now: Date = new Date()): number {
    const nextDay = new Date(now);
    nextDay.setHours(24, 0, 0, 0);

    return Math.max(0, nextDay.getTime() - now.getTime());
  }
}
