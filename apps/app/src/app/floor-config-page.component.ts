import { CommonModule } from '@angular/common';
import { Component, OnInit } from '@angular/core';
import { FloorViewModel, RoomViewModel } from './floor.models';
import { FloorStore } from './floor.store';

@Component({
  selector: 'app-floor-config-page',
  imports: [CommonModule],
  templateUrl: './floor-config-page.component.html',
  styles: [
    `
      :host {
        display: block;
      }
      .page {
        display: grid;
        gap: 12px;
        max-width: 1024px;
        margin: 0 auto;
      }
      .hero,
      .floor-card {
        background: rgba(255, 255, 255, 0.82);
        border: 1px solid rgba(148, 163, 184, 0.24);
        border-radius: 16px;
        box-shadow: 0 10px 28px rgba(15, 23, 42, 0.08);
        backdrop-filter: blur(16px);
      }
      .hero {
        display: flex;
        gap: 12px;
        justify-content: space-between;
        align-items: center;
        padding: 14px;
      }
      .kicker,
      .floor-card p {
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
        font-size: clamp(1.1rem, 2.2vw, 1.6rem);
        line-height: 1.12;
        max-width: 20ch;
      }
      .summary {
        color: #475569;
        margin-top: 6px;
        max-width: 52ch;
        font-size: 0.85rem;
      }
      .stats {
        display: flex;
        gap: 8px;
        flex-wrap: wrap;
      }
      .stats > div {
        background: #f8fafc;
        border: 1px solid rgba(148, 163, 184, 0.2);
        border-radius: 12px;
        display: grid;
        min-width: 86px;
        padding: 8px 10px;
        text-align: center;
      }
      .stats strong {
        font-size: 1.15rem;
        line-height: 1;
      }
      .stats span {
        color: #64748b;
        font-size: 0.72rem;
        margin-top: 2px;
      }
      .grid {
        display: grid;
        gap: 10px;
        grid-auto-flow: column;
        grid-auto-columns: minmax(220px, 1fr);
        overflow-x: auto;
        align-items: start;
        padding-bottom: 4px;
      }
      .floor-card {
        display: grid;
        gap: 10px;
        padding: 12px;
      }
      .floor-card--add {
        align-content: center;
        justify-items: center;
        min-height: 130px;
        color: #1d4ed8;
        font-size: 1.35rem;
        font-weight: 700;
      }
      .floor-card__header,
      .room-card__header {
        align-items: start;
        display: flex;
        gap: 12px;
        justify-content: space-between;
      }
      .floor-card h3 {
        color: #0f172a;
        font-size: 1rem;
      }
      .room-list {
        display: grid;
        gap: 8px;
      }
      .room-card {
        background: #f8fafc;
        border: 1px solid rgba(148, 163, 184, 0.18);
        border-radius: 12px;
        display: grid;
        gap: 8px;
        padding: 8px 10px;
      }
      .room-card strong {
        color: #0f172a;
        font-size: 0.9rem;
      }
      .room-card__actions {
        display: flex;
        gap: 6px;
      }
      .icon-button {
        width: 30px;
        height: 30px;
        border: 0;
        border-radius: 999px;
        cursor: pointer;
        display: inline-flex;
        align-items: center;
        justify-content: center;
        font-weight: 700;
        line-height: 1;
        transition:
          transform 160ms ease,
          opacity 160ms ease,
          background-color 160ms ease;
      }
      .icon-button:hover {
        transform: translateY(-1px);
      }
      .icon-button--dark {
        background: #0f172a;
        color: #f8fafc;
      }
      .icon-button--secondary {
        background: #dbeafe;
        color: #1d4ed8;
      }
      .icon-button--ghost {
        background: #eef2ff;
        color: #4338ca;
      }
      .icon-button--danger {
        background: #fee2e2;
        color: #b91c1c;
      }
      .modal-backdrop {
        position: fixed;
        inset: 0;
        background: rgba(15, 23, 42, 0.42);
        backdrop-filter: blur(2px);
        display: grid;
        place-items: center;
        z-index: 30;
        padding: 16px;
      }
      .modal {
        width: min(100%, 420px);
        background: #fff;
        border-radius: 14px;
        border: 1px solid rgba(148, 163, 184, 0.3);
        box-shadow: 0 20px 44px rgba(15, 23, 42, 0.26);
        display: grid;
        gap: 12px;
        padding: 12px;
      }
      .modal__header,
      .modal__actions {
        display: flex;
        align-items: center;
        justify-content: space-between;
      }
      .modal__body {
        display: grid;
        gap: 10px;
      }
      .modal__actions {
        justify-content: flex-end;
        gap: 8px;
      }
      .modal__actions .icon-button {
        width: auto;
        border-radius: 10px;
        padding: 8px 12px;
      }
      @media (max-width: 900px) {
        .hero {
          flex-direction: column;
        }
      }
    `,
  ],
})
export class FloorConfigPageComponent implements OnInit {
  protected readonly floors$;
  protected roomDetailsModal: {
    floorId: string;
    roomId: string;
    roomNumber: number;
    arrivalDate: string;
    departureDate: string;
  } | null = null;

  constructor(private readonly floorStore: FloorStore) {
    this.floors$ = this.floorStore.floors$;
  }

  async ngOnInit(): Promise<void> {
    await this.floorStore.ensureLoaded();
  }

  async addFloor(): Promise<void> {
    await this.floorStore.addFloor();
  }

  async removeFloor(floorId: string): Promise<void> {
    await this.floorStore.removeFloor(floorId);
  }

  async addRoom(floorId: string): Promise<void> {
    await this.floorStore.addRoom(floorId);
  }

  async removeRoom(floorId: string, roomId: string): Promise<void> {
    await this.floorStore.removeRoom(floorId, roomId);
  }

  protected openRoomDetails(floorId: string, room: RoomViewModel): void {
    this.roomDetailsModal = {
      floorId,
      roomId: room.id,
      roomNumber: room.number,
      arrivalDate: room.arrivalDate ?? '',
      departureDate: room.departureDate ?? '',
    };
  }

  protected closeRoomDetails(): void {
    this.roomDetailsModal = null;
  }

  protected async saveRoomDetails(
    arrivalDateValue: string,
    departureDateValue: string
  ): Promise<void> {
    if (!this.roomDetailsModal) {
      return;
    }

    const { floorId, roomId } = this.roomDetailsModal;
    const arrivalDate = arrivalDateValue || null;
    const departureDate = departureDateValue || null;

    await this.floorStore.updateRoomDetails(floorId, roomId, {
      arrivalDate,
      departureDate,
    });

    this.roomDetailsModal = null;
  }

  protected roomDateRange(room: RoomViewModel): string {
    if (room.arrivalDate && room.departureDate) {
      return `${room.arrivalDate} to ${room.departureDate}`;
    }

    if (room.arrivalDate) {
      return `Arrives ${room.arrivalDate}`;
    }

    if (room.departureDate) {
      return `Leaves ${room.departureDate}`;
    }

    return 'No stay dates';
  }

  protected roomCount(floors: FloorViewModel[]): number {
    return floors.reduce((count, floor) => count + floor.rooms.length, 0);
  }

  protected trackByFloor(_index: number, floor: FloorViewModel): string {
    return floor.id;
  }

  protected trackByRoom(_index: number, room: { id: string }): string {
    return room.id;
  }
}
