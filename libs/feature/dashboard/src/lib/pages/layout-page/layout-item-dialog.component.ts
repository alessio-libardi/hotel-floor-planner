import { CommonModule } from '@angular/common';
import { Component, inject } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import {
  MatDialogModule,
  MatDialogRef,
  MAT_DIALOG_DATA,
} from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { PlanItem, PlanLayoutStore } from '../../plan-layout.store';

export interface LayoutItemDialogData {
  item: PlanItem;
  roomOptions: Array<{
    floorNumber: number;
    roomNumber: number;
    departureDate: string | null;
  }>;
}

@Component({
  selector: 'app-layout-item-dialog',
  imports: [
    CommonModule,
    MatDialogModule,
    MatButtonModule,
    MatFormFieldModule,
    MatIconModule,
    MatInputModule,
    MatSelectModule,
  ],
  templateUrl: './layout-item-dialog.component.html',
})
export class LayoutItemDialogComponent {
  protected selectedItem: PlanItem;

  private readonly store = inject(PlanLayoutStore);
  private readonly dialogRef = inject(MatDialogRef<LayoutItemDialogComponent>);
  protected readonly data = inject<LayoutItemDialogData>(MAT_DIALOG_DATA);

  constructor() {
    this.selectedItem = {
      ...this.data.item,
      linkedTableIds: [...this.data.item.linkedTableIds],
    };
  }

  protected close(): void {
    this.dialogRef.close();
  }

  protected async deleteSelected(): Promise<void> {
    await this.store.deleteItem(this.selectedItem.id);
    this.dialogRef.close({ deleted: true });
  }

  protected async updateSelectedText(text: string): Promise<void> {
    if (this.selectedItem.type === 'table') {
      return;
    }

    await this.store.updateItem(this.selectedItem.id, { text });
    this.selectedItem = { ...this.selectedItem, text };
  }

  protected async updateSelectedRoom(roomNumberValue: string): Promise<void> {
    if (this.selectedItem.type !== 'table') {
      return;
    }

    const roomNumber = roomNumberValue ? Number(roomNumberValue) : null;

    if (roomNumber === this.selectedItem.roomNumber) {
      return;
    }

    const existing = roomNumber
      ? this.store.items.find(
          (item) =>
            item.type === 'table' &&
            item.id !== this.selectedItem.id &&
            item.roomNumber === roomNumber
        )
      : undefined;

    if (existing) {
      await this.store.updateItem(existing.id, { roomNumber: null, text: '' });
    }

    await this.store.updateItem(this.selectedItem.id, {
      roomNumber,
      text: roomNumber ? `Room ${roomNumber}` : '',
    });

    this.selectedItem = {
      ...this.selectedItem,
      roomNumber,
      text: roomNumber ? `Room ${roomNumber}` : '',
    };
  }

  protected availableLinkTargets(): PlanItem[] {
    if (this.selectedItem.type !== 'table') {
      return [];
    }

    return this.store.items
      .filter(
        (item) => item.type === 'table' && item.id !== this.selectedItem.id
      )
      .sort((left, right) => {
        const leftNumber = left.tableNumber ?? Number.MAX_SAFE_INTEGER;
        const rightNumber = right.tableNumber ?? Number.MAX_SAFE_INTEGER;

        if (leftNumber !== rightNumber) {
          return leftNumber - rightNumber;
        }

        return left.id.localeCompare(right.id);
      });
  }

  protected isLinkedToSelected(targetTableId: string): boolean {
    return this.selectedItem.type === 'table'
      ? this.selectedItem.linkedTableIds.includes(targetTableId)
      : false;
  }

  protected tableDisplay(table: PlanItem): string {
    return table.tableNumber ? `Table ${table.tableNumber}` : 'Table';
  }

  protected async toggleSelectedTableLink(
    targetTableId: string
  ): Promise<void> {
    if (this.selectedItem.type !== 'table') {
      return;
    }

    const target = this.store.items.find(
      (item) => item.id === targetTableId && item.type === 'table'
    );

    if (!target) {
      return;
    }

    const shouldUnlink =
      this.selectedItem.linkedTableIds.includes(targetTableId);
    const nextSelectedLinks = shouldUnlink
      ? this.selectedItem.linkedTableIds.filter(
          (entry) => entry !== targetTableId
        )
      : [...this.selectedItem.linkedTableIds, targetTableId];
    const nextTargetLinks = shouldUnlink
      ? target.linkedTableIds.filter((entry) => entry !== this.selectedItem.id)
      : [...target.linkedTableIds, this.selectedItem.id];

    await this.store.updateItem(this.selectedItem.id, {
      linkedTableIds: this.uniqueLinkIds(nextSelectedLinks),
    });
    await this.store.updateItem(target.id, {
      linkedTableIds: this.uniqueLinkIds(nextTargetLinks),
    });

    await this.syncLinkedTableNumbers(this.selectedItem.id);

    const refreshedSelected = this.store.items.find(
      (item) => item.id === this.selectedItem.id
    );
    if (refreshedSelected) {
      this.selectedItem = refreshedSelected;
    }
  }

  protected roomLabel(room: {
    floorNumber: number;
    roomNumber: number;
  }): string {
    return `Floor ${room.floorNumber} - Room ${room.roomNumber}`;
  }

  private uniqueLinkIds(linkedTableIds: string[]): string[] {
    return [...new Set(linkedTableIds)].sort((left, right) =>
      left.localeCompare(right)
    );
  }

  private async syncLinkedTableNumbers(anchorTableId: string): Promise<void> {
    const tables = this.store.items.filter((item) => item.type === 'table');
    if (tables.length === 0) {
      return;
    }

    const components = this.getTableLinkComponents(tables);
    const maxTableNumber = tables.reduce(
      (max, table) => Math.max(max, table.tableNumber ?? 0),
      0
    );

    let nextTableNumber = maxTableNumber + 1;
    const usedNumbers = new Set<number>();
    const updates: Array<Promise<void>> = [];

    const orderedComponents = [...components].sort((left, right) => {
      const leftHasAnchor = left.some((table) => table.id === anchorTableId);
      const rightHasAnchor = right.some((table) => table.id === anchorTableId);

      if (leftHasAnchor !== rightHasAnchor) {
        return leftHasAnchor ? -1 : 1;
      }

      const leftNumbers = left
        .map((table) => table.tableNumber)
        .filter((tableNumber): tableNumber is number => tableNumber != null);
      const rightNumbers = right
        .map((table) => table.tableNumber)
        .filter((tableNumber): tableNumber is number => tableNumber != null);

      const leftMinNumber =
        leftNumbers.length > 0 ? Math.min(...leftNumbers) : null;
      const rightMinNumber =
        rightNumbers.length > 0 ? Math.min(...rightNumbers) : null;

      if (leftMinNumber != null && rightMinNumber != null) {
        if (leftMinNumber !== rightMinNumber) {
          return leftMinNumber - rightMinNumber;
        }
      }

      return left[0].id.localeCompare(right[0].id);
    });

    for (const component of orderedComponents) {
      const existingNumbers = component
        .map((table) => table.tableNumber)
        .filter((tableNumber): tableNumber is number => tableNumber != null)
        .sort((left, right) => left - right);

      let targetNumber = existingNumbers.find(
        (tableNumber) => !usedNumbers.has(tableNumber)
      );

      if (targetNumber == null) {
        targetNumber = nextTableNumber;
        nextTableNumber += 1;
      }

      usedNumbers.add(targetNumber);

      for (const table of component) {
        if (table.tableNumber !== targetNumber) {
          updates.push(
            this.store.updateItem(table.id, { tableNumber: targetNumber })
          );
        }
      }
    }

    await Promise.all(updates);
  }

  private getTableLinkComponents(tables: PlanItem[]): PlanItem[][] {
    const tableById = new Map(tables.map((table) => [table.id, table]));
    const visited = new Set<string>();
    const components: PlanItem[][] = [];

    for (const table of tables) {
      if (visited.has(table.id)) {
        continue;
      }

      const component: PlanItem[] = [];
      const stack = [table.id];

      while (stack.length > 0) {
        const tableId = stack.pop();
        if (!tableId || visited.has(tableId)) {
          continue;
        }

        const current = tableById.get(tableId);
        if (!current) {
          continue;
        }

        visited.add(tableId);
        component.push(current);

        for (const linkedTableId of current.linkedTableIds) {
          if (tableById.has(linkedTableId) && !visited.has(linkedTableId)) {
            stack.push(linkedTableId);
          }
        }

        for (const candidate of tables) {
          if (
            candidate.id !== current.id &&
            candidate.linkedTableIds.includes(current.id) &&
            !visited.has(candidate.id)
          ) {
            stack.push(candidate.id);
          }
        }
      }

      if (component.length > 0) {
        components.push(component);
      }
    }

    return components;
  }
}
