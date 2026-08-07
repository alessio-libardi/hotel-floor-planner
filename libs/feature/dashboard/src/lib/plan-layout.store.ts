import { Injectable, inject } from '@angular/core';
import { BehaviorSubject } from 'rxjs';
import { firstValueFrom } from 'rxjs';
import {
  FloorPlannerApi,
  PlanItemDto,
  PlanItemType,
  PlanItemUpdate,
} from './floor-planner.api';
import { nextGeneratedTableNumber, normalizeTableNumber } from './table-number';
import { normalizeRoomNumbers, primaryRoomNumber } from './room-assignment';
import {
  TableChainChange,
  TableChainRuleFailure,
  tableChainChange,
  tableChainDeletionPatches,
  tableNumberAnchorBackfill,
  tableNumberDisplayMap,
} from './table-link-chain';

export interface PlanItem {
  id: string;
  type: PlanItemType;
  x: number;
  y: number;
  width: number;
  height: number;
  text: string;
  tableNumber: string | null;
  displayTableNumber: string | null;
  roomNumber: number | null;
  roomNumbers: number[];
  linkedTableIds: string[];
  isTableNumberAnchor: boolean;
}

export type PlanItemPatch = Partial<
  Omit<PlanItem, 'id' | 'displayTableNumber'>
>;

export class TableChainRuleError extends Error {
  constructor(readonly reason: TableChainRuleFailure) {
    super(reason);
  }
}

@Injectable({ providedIn: 'root' })
export class PlanLayoutStore {
  private readonly api = inject(FloorPlannerApi);
  private readonly itemsSubject = new BehaviorSubject<PlanItem[]>([]);

  readonly items$ = this.itemsSubject.asObservable();

  get items(): PlanItem[] {
    return this.itemsSubject.value;
  }

  constructor() {
    void this.refresh();
  }

  async refresh(): Promise<void> {
    const items = await firstValueFrom(this.api.getPlanItems());
    let models = items.map((item) => this.toModel(item));
    const backfill = tableNumberAnchorBackfill(models);

    if (backfill.length > 0) {
      await firstValueFrom(this.api.applyPlanItemChanges(backfill));
      models = this.applyUpdates(models, backfill);
    }

    this.setItems(models);
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

  async updateItem(itemId: string, patch: PlanItemPatch): Promise<void> {
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

  tableChainChange(
    sourceTableId: string,
    targetTableId: string
  ): TableChainChange {
    return tableChainChange(this.items, sourceTableId, targetTableId);
  }

  async toggleTableLink(
    sourceTableId: string,
    targetTableId: string
  ): Promise<'link' | 'unlink'> {
    const change = this.tableChainChange(sourceTableId, targetTableId);
    if (!change.ok) {
      throw new TableChainRuleError(change.reason);
    }

    await this.persistUpdates(change.patches);
    return change.action;
  }

  async detachTable(tableId: string): Promise<void> {
    const table = this.items.find(
      (item) => item.id === tableId && item.type === 'table'
    );
    if (!table || table.linkedTableIds.length === 0) {
      return;
    }
    if (table.linkedTableIds.length >= 2) {
      throw new TableChainRuleError('source-middle');
    }

    const change = this.tableChainChange(table.id, table.linkedTableIds[0]);
    if (!change.ok) {
      throw new TableChainRuleError(change.reason);
    }
    await this.persistUpdates(change.patches);
  }

  async deleteItem(itemId: string): Promise<void> {
    const item = this.items.find((entry) => entry.id === itemId);
    if (!item) {
      return;
    }

    const updates: PlanItemUpdate[] =
      item.type === 'table'
        ? tableChainDeletionPatches(this.items, item.id)
        : [];

    await this.persistUpdates(updates, [itemId]);
  }

  private setItems(items: PlanItem[]): void {
    const displayNumbers = tableNumberDisplayMap(items);
    this.itemsSubject.next(
      items.map((item) => ({
        ...item,
        displayTableNumber:
          item.type === 'table'
            ? (displayNumbers.get(item.id) ?? item.tableNumber)
            : null,
      }))
    );
  }

  private toModel(item: PlanItemDto): PlanItem {
    const roomNumbers = normalizeRoomNumbers(item.roomNumbers, item.roomNumber);

    return {
      id: item.id,
      type: item.type,
      x: Number(item.x),
      y: Number(item.y),
      width: Number(item.width),
      height: Number(item.height),
      text: String(item.text ?? ''),
      tableNumber: normalizeTableNumber(item.tableNumber),
      displayTableNumber: normalizeTableNumber(item.tableNumber),
      roomNumber: primaryRoomNumber(roomNumbers),
      roomNumbers,
      linkedTableIds: item.linkedTableIds ?? [],
      isTableNumberAnchor: item.isTableNumberAnchor,
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
      displayTableNumber: type === 'table' ? nextTableNumber : null,
      roomNumber: null,
      roomNumbers: [],
      linkedTableIds: [],
      isTableNumberAnchor: type === 'table',
    };
  }

  private async persistUpdates(
    updates: PlanItemUpdate[],
    deletedIds: string[] = []
  ): Promise<void> {
    const previous = this.items;
    const next = this.applyUpdates(previous, updates).filter(
      (item) => !deletedIds.includes(item.id)
    );
    this.setItems(next);

    try {
      await firstValueFrom(this.api.applyPlanItemChanges(updates, deletedIds));
    } catch (error) {
      this.setItems(previous);
      throw error;
    }
  }

  private applyUpdates(
    items: PlanItem[],
    updates: PlanItemUpdate[]
  ): PlanItem[] {
    const patchesById = new Map(
      updates.map((update) => [update.id, update.patch])
    );
    return items.map((item) => {
      const patch = patchesById.get(item.id);
      return patch ? { ...item, ...patch } : item;
    });
  }
}
