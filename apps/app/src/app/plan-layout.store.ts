import { Injectable } from '@angular/core';
import { BehaviorSubject } from 'rxjs';
import { firstValueFrom } from 'rxjs';
import {
  FloorPlannerApi,
  PlanItemDto,
  PlanItemType,
} from './floor-planner.api';

export interface PlanItem {
  id: string;
  type: PlanItemType;
  x: number;
  y: number;
  width: number;
  height: number;
  text: string;
  tableNumber: number | null;
  roomNumber: number | null;
}

@Injectable({ providedIn: 'root' })
export class PlanLayoutStore {
  private readonly itemsSubject = new BehaviorSubject<PlanItem[]>([]);

  readonly items$ = this.itemsSubject.asObservable();

  get items(): PlanItem[] {
    return this.itemsSubject.value;
  }

  constructor(private readonly api: FloorPlannerApi) {
    void this.refresh();
  }

  async refresh(): Promise<void> {
    const items = await firstValueFrom(this.api.getPlanItems());
    this.itemsSubject.next(items.map((item) => this.toModel(item)));
  }

  async addItem(type: PlanItemType): Promise<PlanItem> {
    const created = await firstValueFrom(this.api.createPlanItem(type));
    const item = this.toModel(created);
    this.setItems([...this.items, item]);
    return item;
  }

  async updateItem(itemId: string, patch: Partial<PlanItem>): Promise<void> {
    const updated = await firstValueFrom(
      this.api.updatePlanItem(itemId, patch)
    );
    const nextItem = this.toModel(updated);
    this.setItems(
      this.items.map((item) => (item.id === itemId ? nextItem : item))
    );
  }

  async deleteItem(itemId: string): Promise<void> {
    await firstValueFrom(this.api.deletePlanItem(itemId));
    this.setItems(this.items.filter((item) => item.id !== itemId));
  }

  private setItems(items: PlanItem[]): void {
    this.itemsSubject.next(items);
  }

  private toModel(item: PlanItemDto): PlanItem {
    return {
      id: item.id,
      type: item.type,
      x: Number(item.x),
      y: Number(item.y),
      width: Number(item.width),
      height: Number(item.height),
      text: String(item.text ?? ''),
      tableNumber: item.tableNumber,
      roomNumber: item.roomNumber,
    };
  }
}
