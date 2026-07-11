import { CommonModule } from '@angular/common';
import { Component, inject } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';
import { MatDialog, MatDialogModule } from '@angular/material/dialog';
import { MatIconModule } from '@angular/material/icon';
import { MatListModule } from '@angular/material/list';
import { DragDropModule, CdkDrag, CdkDragEnd } from '@angular/cdk/drag-drop';
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
}

interface SeatingViewModel {
  floors: FloorViewModel[];
  roomToTableMap: Map<number, RoomTableAssignment>;
  roomNoteMap: Map<number, string | null>;
  today: string;
}

const DAY_IN_MILLISECONDS = 24 * 60 * 60 * 1000;
const SWIPE_ACTION_THRESHOLD = 64;
const SWIPE_CLICK_SUPPRESSION_MS = 500;

@Component({
  selector: 'lib-seating-page',
  imports: [
    CommonModule,
    DragDropModule,
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
        if (item.type !== 'table' || item.tableNumber == null) {
          continue;
        }

        for (const roomNumber of item.roomNumbers) {
          roomToTableMap.set(roomNumber, {
            tableNumber: item.tableNumber,
          });
        }
      }

      return roomToTableMap;
    }),
    shareReplay(1)
  );

  protected readonly roomNoteMap$ = this.floors$.pipe(
    map((floors) => {
      const roomNoteMap = new Map<number, string | null>();
      for (const floor of floors) {
        for (const room of floor.rooms) {
          roomNoteMap.set(room.number, room.note);
        }
      }
      return roomNoteMap;
    }),
    shareReplay(1)
  );

  protected readonly vm$: Observable<SeatingViewModel> = combineLatest({
    floors: this.floors$,
    roomToTableMap: this.roomToTableMap$,
    roomNoteMap: this.roomNoteMap$,
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

  protected handleRoomDragEnded(
    roomId: string,
    checkedDate: string | null,
    today: string,
    drag: CdkDrag,
    event: CdkDragEnd
  ): void {
    const deltaX = event.distance.x;

    if (deltaX <= -SWIPE_ACTION_THRESHOLD) {
      this.swipeClickSuppression.set(roomId, Date.now());
      void this.floorStore.markRoomCheckedToday(roomId);
    } else if (deltaX >= SWIPE_ACTION_THRESHOLD && checkedDate === today) {
      this.swipeClickSuppression.set(roomId, Date.now());
      void this.floorStore.clearRoomCheckedToday(roomId);
    }

    drag.reset();
  }

  protected handleRoomClick(
    roomId: string,
    roomNumber: number,
    note: string | null,
    event: MouseEvent
  ): void {
    const suppressedAt = this.swipeClickSuppression.get(roomId);

    if (
      suppressedAt != null &&
      Date.now() - suppressedAt < SWIPE_CLICK_SUPPRESSION_MS
    ) {
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
    roomNoteMap: Map<number, string | null>,
    roomNumber: number
  ): string | null {
    return roomNoteMap.get(roomNumber) ?? null;
  }

  protected isCheckedToday(checkedDate: string | null, today: string): boolean {
    return checkedDate === today;
  }

  protected printPage(): void {
    window.print();
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
