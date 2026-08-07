import { AsyncPipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatDialog } from '@angular/material/dialog';
import { MatIconModule } from '@angular/material/icon';
import {
  combineLatest,
  defer,
  from,
  map,
  Observable,
  shareReplay,
  startWith,
  switchMap,
  timer,
} from 'rxjs';
import { FloorViewModel } from '../../floor.models';
import { FloorStore } from '../../floor.store';
import { PlanLayoutStore } from '../../plan-layout.store';
import { SeatingFloorColumnComponent } from '../components/seating-floor-column/seating-floor-column.component';
import {
  SeatingRoomNoteDialogComponent,
  SeatingRoomNoteDialogData,
} from '../components/seating-room-note-dialog/seating-room-note-dialog.component';
import {
  createSeatingFloors,
  SeatingPageViewModel,
  SeatingRoomCheckChange,
  SeatingRoomViewModel,
} from './seating-view-model';

const DAY_IN_MILLISECONDS = 24 * 60 * 60 * 1000;

@Component({
  selector: 'lib-seating-page',
  imports: [
    AsyncPipe,
    MatButtonModule,
    MatIconModule,
    SeatingFloorColumnComponent,
  ],
  templateUrl: './seating-page.component.html',
  styleUrls: ['./seating-page.component.css'],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class SeatingPageComponent {
  private readonly floorStore = inject(FloorStore);
  private readonly planStore = inject(PlanLayoutStore);
  private readonly dialog = inject(MatDialog);

  private readonly floors$: Observable<FloorViewModel[]> = defer(() =>
    from(this.floorStore.ensureLoaded()).pipe(
      switchMap(() => this.floorStore.floors$)
    )
  ).pipe(shareReplay(1));

  private readonly today$ = timer(
    this.msUntilTomorrow(),
    DAY_IN_MILLISECONDS
  ).pipe(
    map(() => this.formatDateOnly(new Date())),
    startWith(this.formatDateOnly(new Date())),
    shareReplay(1)
  );

  protected readonly vm$: Observable<SeatingPageViewModel> = combineLatest({
    floors: this.floors$,
    items: this.planStore.items$,
    today: this.today$,
  }).pipe(
    map(({ floors, items, today }) => ({
      floors: createSeatingFloors(floors, items, today),
    })),
    shareReplay(1)
  );

  protected openRoomDetails(room: SeatingRoomViewModel): void {
    this.dialog.open<SeatingRoomNoteDialogComponent, SeatingRoomNoteDialogData>(
      SeatingRoomNoteDialogComponent,
      {
        width: 'min(90vw, 420px)',
        data: {
          roomNumber: room.number,
          note: room.note,
        },
      }
    );
  }

  protected handleRoomCheckedChange(change: SeatingRoomCheckChange): void {
    if (change.checked) {
      void this.floorStore.markRoomCheckedToday(change.roomId);
      return;
    }

    void this.floorStore.clearRoomCheckedToday(change.roomId);
  }

  protected printPage(): void {
    window.print();
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
