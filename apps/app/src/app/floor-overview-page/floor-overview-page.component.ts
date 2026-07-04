import { CommonModule } from '@angular/common';
import { Component, inject } from '@angular/core';
import { RouterLink } from '@angular/router';
import { MatButtonModule } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';
import { MatChipsModule } from '@angular/material/chips';
import { MatIconModule } from '@angular/material/icon';
import {
  combineLatest,
  defer,
  from,
  map,
  Observable,
  shareReplay,
  switchMap,
} from 'rxjs';
import { FloorViewModel } from '../floor.models';
import { FloorStore } from '../floor.store';
import { PlanLayoutStore } from '../plan-layout.store';

@Component({
  selector: 'app-floor-overview-page',
  imports: [
    CommonModule,
    RouterLink,
    MatButtonModule,
    MatCardModule,
    MatChipsModule,
    MatIconModule,
  ],
  templateUrl: './floor-overview-page.component.html',
  styleUrl: './floor-overview-page.component.css',
})
export class FloorOverviewPageComponent {
  private readonly floorStore = inject(FloorStore);
  private readonly planStore = inject(PlanLayoutStore);

  protected readonly floors$: Observable<FloorViewModel[]> = defer(() =>
    from(this.floorStore.ensureLoaded()).pipe(
      switchMap(() => this.floorStore.floors$)
    )
  ).pipe(shareReplay(1));

  protected readonly roomToTableMap$ = this.planStore.items$.pipe(
    map((items) => {
      const roomToTableMap = new Map<number, number>();

      for (const item of items) {
        if (
          item.type !== 'table' ||
          item.roomNumber == null ||
          item.tableNumber == null
        ) {
          continue;
        }

        roomToTableMap.set(item.roomNumber, item.tableNumber);
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

  protected tableNumberForRoom(
    roomToTableMap: Map<number, number>,
    roomNumber: number
  ): number | null {
    return roomToTableMap.get(roomNumber) ?? null;
  }
}
