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
  shareReplay,
  switchMap,
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

  protected readonly floors$: Observable<FloorViewModel[]> = defer(() =>
    from(this.floorStore.ensureLoaded()).pipe(
      switchMap(() => this.floorStore.floors$)
    )
  ).pipe(shareReplay(1));

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

  protected readonly vm$ = combineLatest({
    floors: this.floors$,
    roomToTableMap: this.roomToTableMap$,
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
}
