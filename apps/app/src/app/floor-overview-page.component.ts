import { CommonModule } from '@angular/common';
import { Component, inject } from '@angular/core';
import { RouterLink } from '@angular/router';
import {
  combineLatest,
  defer,
  from,
  map,
  Observable,
  shareReplay,
  switchMap,
} from 'rxjs';
import { FloorViewModel } from './floor.models';
import { FloorStore } from './floor.store';
import { PlanLayoutStore } from './plan-layout.store';

@Component({
  selector: 'app-floor-overview-page',
  imports: [CommonModule, RouterLink],
  template: `
    <section class="page" *ngIf="vm$ | async as vm">
      <div class="overview-layout">
        <div class="floors-panel">
          <div class="hero">
            <div>
              <p class="kicker">Overview</p>
              <h2>Compact read-only view</h2>
            </div>
            <a routerLink="/configure" class="primary">Configure</a>
          </div>

          <div class="grid">
            <article
              class="floor-card"
              *ngFor="let floor of vm.floors; trackBy: trackByFloor"
            >
              <header>
                <div>
                  <p>Floor {{ floor.number }}</p>
                  <h3>{{ floor.rooms.length }} rooms</h3>
                </div>
              </header>

              <div
                class="room-list"
                *ngIf="floor.rooms.length; else emptyFloor"
              >
                <div
                  class="room-pill"
                  *ngFor="let room of floor.rooms; trackBy: trackByRoom"
                >
                  <strong>{{ room.number }}</strong>
                  <span
                    class="room-table"
                    [class.room-table--empty]="
                      !tableNumberForRoom(vm.roomToTableMap, room.number)
                    "
                  >
                    {{
                      tableNumberForRoom(vm.roomToTableMap, room.number)
                        ? 'Table ' +
                          tableNumberForRoom(vm.roomToTableMap, room.number)
                        : 'No table'
                    }}
                  </span>
                </div>
              </div>

              <ng-template #emptyFloor>
                <p class="empty">No rooms</p>
              </ng-template>
            </article>
          </div>
        </div>
      </div>
    </section>
  `,
  styles: [
    `
      :host {
        display: block;
      }
      .page {
        max-width: 1280px;
        margin: 0 auto;
      }
      .overview-layout {
        display: grid;
        grid-template-columns: minmax(0, 1fr);
        gap: 12px;
        align-items: start;
      }
      .floors-panel {
        background: rgba(255, 255, 255, 0.86);
        border: 1px solid rgba(148, 163, 184, 0.24);
        border-radius: 16px;
        box-shadow: 0 10px 28px rgba(15, 23, 42, 0.08);
      }
      .floors-panel {
        padding: 12px;
        display: grid;
        gap: 10px;
      }
      .hero {
        align-items: center;
        display: flex;
        justify-content: space-between;
        gap: 12px;
      }
      .kicker {
        color: #2563eb;
        font-size: 0.68rem;
        font-weight: 700;
        letter-spacing: 0.12em;
        margin: 0 0 4px;
        text-transform: uppercase;
      }
      h2,
      h3,
      p {
        margin: 0;
      }
      h2 {
        font-size: 1.15rem;
      }
      .primary {
        background: #0f172a;
        border-radius: 999px;
        color: #f8fafc;
        text-decoration: none;
        padding: 8px 12px;
        font-size: 0.85rem;
      }
      .grid {
        display: grid;
        gap: 8px;
        grid-auto-flow: column;
        grid-auto-columns: minmax(180px, 1fr);
        overflow-x: auto;
      }
      .floor-card {
        background: #f8fafc;
        border: 1px solid rgba(148, 163, 184, 0.2);
        border-radius: 12px;
        display: grid;
        gap: 8px;
        padding: 10px;
      }
      .floor-card p {
        color: #2563eb;
        font-size: 0.66rem;
        font-weight: 700;
        letter-spacing: 0.12em;
        margin-bottom: 2px;
        text-transform: uppercase;
      }
      .floor-card h3 {
        font-size: 0.9rem;
        color: #0f172a;
      }
      .room-list {
        display: grid;
        gap: 6px;
      }
      .room-pill {
        background: #fff;
        border: 1px solid rgba(148, 163, 184, 0.2);
        border-radius: 8px;
        padding: 6px 8px;
        font-size: 0.82rem;
        color: #0f172a;
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: 10px;
      }
      .room-table {
        background: #dbeafe;
        color: #1d4ed8;
        border-radius: 999px;
        padding: 4px 8px;
        font-size: 0.8rem;
        font-weight: 600;
        white-space: nowrap;
      }
      .room-table--empty {
        background: #f1f5f9;
        color: #64748b;
      }
      .empty {
        color: #64748b;
        font-size: 0.82rem;
      }
      @media (max-width: 980px) {
        .overview-layout {
          grid-template-columns: 1fr;
        }
      }
    `,
  ],
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
