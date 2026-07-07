import { Injectable } from '@angular/core';
import { BehaviorSubject } from 'rxjs';
import { firstValueFrom } from 'rxjs';
import {
  FloorPlannerApi,
  PlanItemDto,
  PlanItemType,
} from './floor-planner.api';
import { nextGeneratedTableNumber, normalizeTableNumber } from './table-number';

export interface PlanItem {
  id: string;
  type: PlanItemType;
  x: number;
  y: number;
  width: number;
  height: number;
  text: string;
  tableNumber: string | null;
  roomNumber: number | null;
  linkedTableIds: string[];
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
    const previous = this.items;
    const optimistic = this.createOptimisticItem(type);

    this.setItems([...previous, optimistic]);

    try {
      const created = await firstValueFrom(this.api.createPlanItem(type));
      const item = this.toModel(created);
      this.setItems(
        this.items.map((entry) => (entry.id === optimistic.id ? item : entry))
      );
      return item;
    } catch (error) {
      this.setItems(previous);
      throw error;
    }
  }

  async updateItem(itemId: string, patch: Partial<PlanItem>): Promise<void> {
    const previous = this.items;
    this.setItems(
      this.items.map((item) =>
        item.id === itemId ? { ...item, ...patch } : item
      )
    );

    try {
      const updated = await firstValueFrom(
        this.api.updatePlanItem(itemId, patch)
      );
      const nextItem = this.toModel(updated);
      this.setItems(
        this.items.map((item) => (item.id === itemId ? nextItem : item))
      );
    } catch (error) {
      this.setItems(previous);
      throw error;
    }
  }

  async deleteItem(itemId: string): Promise<void> {
    const previous = this.items;
    const withoutDeleted = this.items.filter((item) => item.id !== itemId);
    this.setItems(
      withoutDeleted.map((item) => ({
        ...item,
        linkedTableIds: item.linkedTableIds.filter(
          (linkedTableId) => linkedTableId !== itemId
        ),
      }))
    );

    try {
      await firstValueFrom(this.api.deletePlanItem(itemId));
    } catch (error) {
      this.setItems(previous);
      throw error;
    }
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
      tableNumber: normalizeTableNumber(item.tableNumber),
      roomNumber: item.roomNumber,
      linkedTableIds: item.linkedTableIds ?? [],
    };
  }

  private createOptimisticItem(type: PlanItemType): PlanItem {
    const nextTableNumber = nextGeneratedTableNumber(
      this.items
        .filter((item) => item.type === 'table')
        .map((item) => item.tableNumber)
    );

    return {
      id: `tmp_item_${Date.now()}_${Math.random().toString(16).slice(2)}`,
      type,
      x: 48,
      y: 48,
      width: type === 'label' ? 120 : 74,
      height: type === 'label' ? 28 : 74,
      text: type === 'column' ? 'Column' : '',
      tableNumber: type === 'table' ? nextTableNumber : null,
      roomNumber: null,
      linkedTableIds: [],
    };
  }
}
