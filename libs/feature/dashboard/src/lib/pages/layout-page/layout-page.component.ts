import { CommonModule } from '@angular/common';
import {
  AfterViewInit,
  Component,
  ElementRef,
  OnDestroy,
  ViewChild,
  signal,
} from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatDialog, MatDialogModule } from '@angular/material/dialog';
import { MatIconModule } from '@angular/material/icon';
import { MatToolbarModule } from '@angular/material/toolbar';
import Konva from 'konva';
import { inject } from '@angular/core';
import { firstValueFrom, Subscription, fromEvent } from 'rxjs';
import { FloorViewModel } from '../../floor.models';
import { FloorStore } from '../../floor.store';
import { PlanItem, PlanLayoutStore } from '../../plan-layout.store';
import {
  LayoutItemDialogComponent,
  LayoutItemDialogData,
} from './layout-item-dialog.component';

const GRID_SIZE = 24;
const GRID_EXTENT = 6000;
const MIN_SCALE = 0.5;
const MAX_SCALE = 2.6;
const SCALE_STEP = 1.15;
const FOCUS_PADDING = 64;
const DOUBLE_CLICK_MS = 320;
const MIN_CONTAINER_SIZE = GRID_SIZE;

@Component({
  selector: 'app-layout-page',
  imports: [
    CommonModule,
    MatButtonModule,
    MatDialogModule,
    MatIconModule,
    MatToolbarModule,
  ],
  templateUrl: './layout-page.component.html',
  styleUrls: ['./layout-page.component.css'],
})
export class LayoutPageComponent implements AfterViewInit, OnDestroy {
  @ViewChild('stageHost', { static: true })
  private readonly stageHost!: ElementRef<HTMLDivElement>;

  protected readonly selectedItem = signal<PlanItem | null>(null);
  protected roomOptions: Array<{
    floorNumber: number;
    roomNumber: number;
    departureDate: string | null;
  }> = [];
  protected readonly isPanMode = signal(true);

  private readonly dialog = inject(MatDialog);

  private viewScale = 1;
  private viewX = 0;
  private viewY = 0;

  private stage: Konva.Stage | null = null;
  private gridLayer: Konva.Layer | null = null;
  private itemLayer: Konva.Layer | null = null;
  private transformer: Konva.Transformer | null = null;
  private resizeSub: Subscription | null = null;
  private storeSub: Subscription | null = null;
  private floorsSub: Subscription | null = null;
  private hasAutoFocusedInitialItems = false;
  private lastItemClickId: string | null = null;
  private lastItemClickAt = 0;

  constructor(
    private readonly store: PlanLayoutStore,
    private readonly floorStore: FloorStore
  ) {}

  ngAfterViewInit(): void {
    this.initStage();
    this.drawGrid();
    void this.floorStore.ensureLoaded();

    this.floorsSub = this.floorStore.floors$.subscribe((floors) => {
      this.roomOptions = this.extractRooms(floors);
      this.renderItems();
    });

    this.storeSub = this.store.items$.subscribe((items) => {
      this.renderItems();

      if (!this.hasAutoFocusedInitialItems && items.length > 0) {
        this.hasAutoFocusedInitialItems = true;
        this.resetView();
      }
    });

    this.resizeSub = fromEvent(window, 'resize').subscribe(() => {
      this.resizeStage();
      this.drawGrid();
      this.renderItems();
    });
  }

  ngOnDestroy(): void {
    this.floorsSub?.unsubscribe();
    this.resizeSub?.unsubscribe();
    this.storeSub?.unsubscribe();
    this.stage?.destroy();
  }

  protected async addTable(): Promise<void> {
    const item = await this.store.addItem('table');
    this.setPanMode(false);
    this.selectById(item.id);
  }

  protected async addColumn(): Promise<void> {
    const item = await this.store.addItem('column');
    this.setPanMode(false);
    this.selectById(item.id);
  }

  protected async removeSelected(): Promise<void> {
    const selected = this.selectedItem();
    if (!selected) {
      return;
    }

    await this.store.deleteItem(selected.id);
    this.selectedItem.set(null);
  }

  protected async openSelectedEditor(): Promise<void> {
    const selected = this.selectedItem();
    if (!selected) {
      return;
    }

    const dialogRef = this.dialog.open<
      LayoutItemDialogComponent,
      LayoutItemDialogData
    >(LayoutItemDialogComponent, {
      data: {
        item: selected,
        roomOptions: this.roomOptions,
      },
    });

    await firstValueFrom(dialogRef.afterClosed());

    this.selectById(selected.id);
  }

  protected async updateSelectedText(text: string): Promise<void> {
    const selected = this.selectedItem();
    if (!selected) {
      return;
    }

    await this.store.updateItem(selected.id, { text });
    this.selectedItem.set({ ...selected, text });
  }

  protected async updateSelectedRoom(roomNumberValue: string): Promise<void> {
    const selected = this.selectedItem();
    if (!selected || selected.type !== 'table') {
      return;
    }

    const roomNumber = roomNumberValue ? Number(roomNumberValue) : null;

    if (roomNumber === selected.roomNumber) {
      return;
    }

    const existing = roomNumber
      ? this.store.items.find(
          (item) =>
            item.type === 'table' &&
            item.id !== selected.id &&
            item.roomNumber === roomNumber
        )
      : undefined;

    if (existing) {
      await this.store.updateItem(existing.id, { roomNumber: null, text: '' });
    }

    await this.store.updateItem(selected.id, {
      roomNumber,
      text: roomNumber ? `Room ${roomNumber}` : '',
    });

    this.selectedItem.set({
      ...selected,
      roomNumber,
      text: roomNumber ? `Room ${roomNumber}` : '',
    });
  }

  protected availableLinkTargets(selected: PlanItem): PlanItem[] {
    if (selected.type !== 'table') {
      return [];
    }

    return this.store.items
      .filter((item) => item.type === 'table' && item.id !== selected.id)
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
    const selected = this.selectedItem();
    return selected?.type === 'table'
      ? selected.linkedTableIds.includes(targetTableId)
      : false;
  }

  protected tableDisplay(table: PlanItem): string {
    return table.tableNumber ? `Table ${table.tableNumber}` : 'Table';
  }

  protected async toggleSelectedTableLink(
    targetTableId: string
  ): Promise<void> {
    const selected = this.selectedItem();

    if (!selected || selected.type !== 'table') {
      return;
    }

    const target = this.store.items.find(
      (item) => item.id === targetTableId && item.type === 'table'
    );

    if (!target) {
      return;
    }

    const shouldUnlink = selected.linkedTableIds.includes(targetTableId);
    const nextSelectedLinks = shouldUnlink
      ? selected.linkedTableIds.filter((entry) => entry !== targetTableId)
      : [...selected.linkedTableIds, targetTableId];
    const nextTargetLinks = shouldUnlink
      ? target.linkedTableIds.filter((entry) => entry !== selected.id)
      : [...target.linkedTableIds, selected.id];

    await this.store.updateItem(selected.id, {
      linkedTableIds: this.uniqueLinkIds(nextSelectedLinks),
    });
    await this.store.updateItem(target.id, {
      linkedTableIds: this.uniqueLinkIds(nextTargetLinks),
    });

    await this.syncLinkedTableNumbers(selected.id);

    const refreshedSelected = this.store.items.find(
      (item) => item.id === selected.id
    );
    if (refreshedSelected) {
      this.selectedItem.set(refreshedSelected);
    }
  }

  protected roomLabel(room: {
    floorNumber: number;
    roomNumber: number;
  }): string {
    return `Floor ${room.floorNumber} - Room ${room.roomNumber}`;
  }

  protected zoomIn(): void {
    this.zoomBy(SCALE_STEP);
  }

  protected zoomOut(): void {
    this.zoomBy(1 / SCALE_STEP);
  }

  protected resetView(): void {
    if (!this.stage) {
      return;
    }

    const bounds = this.getItemsBounds();
    if (!bounds) {
      this.viewScale = 1;
      this.viewX = 0;
      this.viewY = 0;
      this.applyViewportTransform();
      return;
    }

    const stageWidth = this.stage.width();
    const stageHeight = this.stage.height();

    if (stageWidth <= 0 || stageHeight <= 0) {
      return;
    }

    const paddedWidth = Math.max(bounds.width, 1) + FOCUS_PADDING * 2;
    const paddedHeight = Math.max(bounds.height, 1) + FOCUS_PADDING * 2;

    const scaleX = stageWidth / paddedWidth;
    const scaleY = stageHeight / paddedHeight;

    this.viewScale = this.clamp(Math.min(scaleX, scaleY), MIN_SCALE, MAX_SCALE);

    const boundsCenterX = bounds.minX + bounds.width / 2;
    const boundsCenterY = bounds.minY + bounds.height / 2;

    this.viewX = stageWidth / 2 - boundsCenterX * this.viewScale;
    this.viewY = stageHeight / 2 - boundsCenterY * this.viewScale;

    this.applyViewportTransform();
  }

  protected setPanMode(enabled: boolean): void {
    if (this.isPanMode() === enabled) {
      return;
    }

    this.isPanMode.set(enabled);
    this.updatePanMode();
    this.renderItems();
  }

  private initStage(): void {
    const host = this.stageHost.nativeElement;
    this.stage = new Konva.Stage({
      container: host,
      width: host.clientWidth,
      height: host.clientHeight,
    });

    this.gridLayer = new Konva.Layer({ listening: false });
    this.itemLayer = new Konva.Layer();
    this.transformer = new Konva.Transformer({
      rotateEnabled: false,
      enabledAnchors: ['top-left', 'top-right', 'bottom-left', 'bottom-right'],
      keepRatio: true,
      centeredScaling: false,
      borderStroke: '#2563eb',
      borderStrokeWidth: 1,
      anchorSize: 10,
      anchorStroke: '#2563eb',
      anchorFill: '#dbeafe',
      anchorCornerRadius: 2,
    });
    this.transformer.on('transformend', () => {
      void this.commitContainerResize();
    });

    this.stage.add(this.gridLayer);
    this.stage.add(this.itemLayer);
    this.itemLayer.add(this.transformer);

    this.stage.on('wheel', (event) => {
      event.evt.preventDefault();

      const pointer = this.stage?.getPointerPosition();
      if (!pointer) {
        return;
      }

      const factor = event.evt.deltaY > 0 ? 1 / SCALE_STEP : SCALE_STEP;
      this.zoomBy(factor, pointer);
    });

    this.stage.on('dragmove', () => {
      if (!this.stage) {
        return;
      }

      this.viewX = this.stage.x();
      this.viewY = this.stage.y();
    });

    this.stage.on('click', (event) => {
      if (event.target === this.stage) {
        this.selectedItem.set(null);
        this.renderItems();
      }
    });

    this.updatePanMode();
  }

  private resizeStage(): void {
    if (!this.stage) {
      return;
    }

    this.stage.width(this.stageHost.nativeElement.clientWidth);
    this.stage.height(this.stageHost.nativeElement.clientHeight);
    this.applyViewportTransform();
  }

  private drawGrid(): void {
    if (!this.stage || !this.gridLayer) {
      return;
    }

    this.gridLayer.destroyChildren();

    for (let x = -GRID_EXTENT; x <= GRID_EXTENT; x += GRID_SIZE) {
      this.gridLayer.add(
        new Konva.Line({
          points: [x, -GRID_EXTENT, x, GRID_EXTENT],
          stroke: '#e2e8f0',
          strokeWidth: 1,
        })
      );
    }

    for (let y = -GRID_EXTENT; y <= GRID_EXTENT; y += GRID_SIZE) {
      this.gridLayer.add(
        new Konva.Line({
          points: [-GRID_EXTENT, y, GRID_EXTENT, y],
          stroke: '#e2e8f0',
          strokeWidth: 1,
        })
      );
    }

    this.gridLayer.draw();
  }

  private renderItems(): void {
    if (!this.itemLayer || !this.transformer) {
      return;
    }

    this.transformer.nodes([]);
    this.itemLayer.destroyChildren();
    this.drawTableLinks();

    for (const item of this.store.items) {
      const node = this.createNode(item);
      this.itemLayer.add(node);
    }

    this.attachContainerResizeHandle();

    this.itemLayer.draw();
  }

  private createNode(item: PlanItem): Konva.Group | Konva.Shape {
    const selected = this.selectedItem()?.id === item.id;

    if (item.type === 'label') {
      const text = new Konva.Text({
        id: item.id,
        x: item.x,
        y: item.y,
        text: item.text,
        fontSize: 16,
        fill: '#1e293b',
        draggable: !this.isPanMode(),
        listening: !this.isPanMode(),
      });

      this.wireNodeInteractions(text, item.id);
      return text;
    }

    const group = new Konva.Group({
      id: item.id,
      x: item.x,
      y: item.y,
      draggable: !this.isPanMode(),
      listening: !this.isPanMode(),
    });

    const rect = new Konva.Rect({
      width: item.width,
      height: item.height,
      cornerRadius: item.type === 'table' ? 12 : 6,
      fill: this.itemFillColor(item),
      stroke: this.itemBorderColor(selected),
      strokeWidth: selected ? 3 : 1,
    });

    group.add(rect);

    if (item.type === 'table' || item.type === 'column') {
      group.add(
        new Konva.Text({
          x: 0,
          y: item.height / 2 - 8,
          width: item.width,
          align: 'center',
          text: item.text,
          fontSize: 14,
          fill: '#0f172a',
          listening: false,
        })
      );

      if (item.type === 'table') {
        group.add(
          new Konva.Text({
            x: 6,
            y: 6,
            text: item.tableNumber ? `T${item.tableNumber}` : 'T?',
            fontSize: 11,
            fill: '#1d4ed8',
            listening: false,
          })
        );
      }
    }

    this.wireNodeInteractions(group, item.id);
    return group;
  }

  private drawTableLinks(): void {
    if (!this.itemLayer) {
      return;
    }

    const tables = this.store.items.filter((item) => item.type === 'table');
    const tablesById = new Map(tables.map((table) => [table.id, table]));
    const renderedLinks = new Set<string>();
    const selectedId = this.selectedItem()?.id;

    for (const table of tables) {
      for (const linkedId of table.linkedTableIds) {
        const linkedTable = tablesById.get(linkedId);

        if (!linkedTable) {
          continue;
        }

        const key = [table.id, linkedTable.id].sort().join(':');
        if (renderedLinks.has(key)) {
          continue;
        }

        renderedLinks.add(key);

        const [startX, startY] = this.tableCenter(table);
        const [endX, endY] = this.tableCenter(linkedTable);
        const highlighted =
          selectedId === table.id || selectedId === linkedTable.id;

        this.itemLayer.add(
          new Konva.Line({
            points: [startX, startY, endX, endY],
            stroke: highlighted ? '#2563eb' : '#94a3b8',
            strokeWidth: highlighted ? 4 : 2,
            dash: [8, 6],
            lineCap: 'round',
            listening: false,
          })
        );
      }
    }
  }

  private wireNodeInteractions(node: Konva.Node, itemId: string): void {
    if (!this.isPanMode()) {
      node.dragBoundFunc((position) => ({
        x: this.snap(position.x),
        y: this.snap(position.y),
      }));
    }

    node.on('click tap', () => {
      if (this.isPanMode()) {
        return;
      }

      const now = Date.now();
      const isDoubleClick =
        this.lastItemClickId === itemId &&
        now - this.lastItemClickAt <= DOUBLE_CLICK_MS;

      this.selectById(itemId);

      if (isDoubleClick) {
        this.lastItemClickId = null;
        this.lastItemClickAt = 0;
        void this.openSelectedEditor();
        return;
      }

      this.lastItemClickId = itemId;
      this.lastItemClickAt = now;
    });

    node.on('dragend', () => {
      if (this.isPanMode()) {
        return;
      }

      const x = this.snap(node.x());
      const y = this.snap(node.y());
      node.position({ x, y });
      void this.store.updateItem(itemId, { x, y });
      this.selectById(itemId);
    });
  }

  private extractRooms(floors: FloorViewModel[]): Array<{
    floorNumber: number;
    roomNumber: number;
    departureDate: string | null;
  }> {
    return floors.flatMap((floor) =>
      floor.rooms.map((room) => ({
        floorNumber: floor.number,
        roomNumber: room.number,
        departureDate: room.departureDate,
      }))
    );
  }

  private selectById(itemId: string): void {
    const item = this.store.items.find((entry) => entry.id === itemId) ?? null;
    this.selectedItem.set(item);
    this.renderItems();
  }

  private snap(value: number): number {
    return Math.round(value / GRID_SIZE) * GRID_SIZE;
  }

  private tableCenter(table: PlanItem): [number, number] {
    return [table.x + table.width / 2, table.y + table.height / 2];
  }

  private attachContainerResizeHandle(): void {
    if (!this.itemLayer || !this.transformer || this.isPanMode()) {
      return;
    }

    const selected = this.selectedItem();
    if (!selected || selected.type !== 'column') {
      return;
    }

    const selectedNode = this.findItemGroupNode(selected.id);
    if (!(selectedNode instanceof Konva.Group)) {
      return;
    }

    selectedNode.off('transform.layout-resize');
    selectedNode.on('transform.layout-resize', () => {
      const rect = this.findContainerRect(selectedNode);
      if (!rect) {
        return;
      }

      const nextSize = this.snapSquareSize(
        Math.max(
          rect.width() * selectedNode.scaleX(),
          rect.height() * selectedNode.scaleY()
        )
      );

      selectedNode.width(nextSize);
      selectedNode.height(nextSize);
      selectedNode.scale({ x: 1, y: 1 });

      rect.width(nextSize);
      rect.height(nextSize);

      const contentText = selectedNode
        .getChildren()
        .find((child) => child instanceof Konva.Text && child.y() > 0);
      if (contentText instanceof Konva.Text) {
        contentText.width(nextSize);
        contentText.y(nextSize / 2 - 8);
      }
    });

    this.transformer.nodes([selectedNode]);
    this.itemLayer.add(this.transformer);
  }

  private async commitContainerResize(): Promise<void> {
    if (!this.itemLayer || !this.transformer) {
      return;
    }

    const selected = this.selectedItem();
    if (!selected || selected.type !== 'column') {
      return;
    }

    const selectedNode = this.findItemGroupNode(selected.id);
    if (!(selectedNode instanceof Konva.Group)) {
      return;
    }

    const rect = this.findContainerRect(selectedNode);
    if (!rect) {
      return;
    }

    const nextSize = this.snapSquareSize(Math.max(rect.width(), rect.height()));
    const x = this.snap(selectedNode.x());
    const y = this.snap(selectedNode.y());

    selectedNode.position({ x, y });
    selectedNode.width(nextSize);
    selectedNode.height(nextSize);
    selectedNode.scale({ x: 1, y: 1 });
    rect.width(nextSize);
    rect.height(nextSize);

    await this.store.updateItem(selected.id, {
      x,
      y,
      width: nextSize,
      height: nextSize,
    });

    this.selectById(selected.id);
  }

  private snapSquareSize(value: number): number {
    return Math.max(MIN_CONTAINER_SIZE, this.snap(value));
  }

  private findContainerRect(node: Konva.Group): Konva.Rect | null {
    const rect = node
      .getChildren()
      .find((child) => child instanceof Konva.Rect);
    return rect instanceof Konva.Rect ? rect : null;
  }

  private findItemGroupNode(itemId: string): Konva.Group | null {
    if (!this.itemLayer) {
      return null;
    }

    const group = this.itemLayer
      .getChildren()
      .find((child) => child instanceof Konva.Group && child.id() === itemId);

    return group instanceof Konva.Group ? group : null;
  }

  private getItemsBounds(): {
    minX: number;
    minY: number;
    width: number;
    height: number;
  } | null {
    const items = this.store.items;
    if (items.length === 0) {
      return null;
    }

    let minX = Number.POSITIVE_INFINITY;
    let minY = Number.POSITIVE_INFINITY;
    let maxX = Number.NEGATIVE_INFINITY;
    let maxY = Number.NEGATIVE_INFINITY;

    for (const item of items) {
      minX = Math.min(minX, item.x);
      minY = Math.min(minY, item.y);
      maxX = Math.max(maxX, item.x + item.width);
      maxY = Math.max(maxY, item.y + item.height);
    }

    return {
      minX,
      minY,
      width: maxX - minX,
      height: maxY - minY,
    };
  }

  private uniqueLinkIds(linkedTableIds: string[]): string[] {
    return [...new Set(linkedTableIds)].sort((left, right) =>
      left.localeCompare(right)
    );
  }

  private itemBorderColor(selected: boolean): string {
    return selected ? '#2563eb' : '#94a3b8';
  }

  private itemFillColor(item: PlanItem): string {
    if (item.type === 'table' && this.isAssignedRoomEmpty(item.roomNumber)) {
      return '#fee2e2';
    }

    return item.type === 'table' ? '#dbeafe' : '#f1f5f9';
  }

  private isAssignedRoomEmpty(roomNumber: number | null): boolean {
    if (roomNumber == null) {
      return false;
    }

    const room = this.roomOptions.find(
      (entry) => entry.roomNumber === roomNumber
    );
    if (!room?.departureDate) {
      return false;
    }

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const departureDate = new Date(room.departureDate);
    departureDate.setHours(0, 0, 0, 0);

    return departureDate <= today;
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

  private zoomBy(factor: number, center?: { x: number; y: number }): void {
    if (!this.stage) {
      return;
    }

    const anchor = center ?? {
      x: this.stage.width() / 2,
      y: this.stage.height() / 2,
    };

    const nextScale = this.clamp(this.viewScale * factor, MIN_SCALE, MAX_SCALE);
    const worldX = (anchor.x - this.viewX) / this.viewScale;
    const worldY = (anchor.y - this.viewY) / this.viewScale;

    this.viewScale = nextScale;
    this.viewX = anchor.x - worldX * this.viewScale;
    this.viewY = anchor.y - worldY * this.viewScale;

    this.applyViewportTransform();
  }

  private applyViewportTransform(): void {
    if (!this.stage) {
      return;
    }

    this.stage.scale({ x: this.viewScale, y: this.viewScale });
    this.stage.position({ x: this.viewX, y: this.viewY });
    this.stage.batchDraw();
  }

  private updatePanMode(): void {
    if (!this.stage) {
      return;
    }

    const panEnabled = this.isPanMode();
    this.stage.draggable(panEnabled);
    this.stage.container().style.cursor = panEnabled ? 'grab' : 'default';

    if (panEnabled) {
      this.selectedItem.set(null);
    }

    if (!panEnabled) {
      this.stage.stopDrag();
    }
  }

  private clamp(value: number, min: number, max: number): number {
    return Math.max(min, Math.min(max, value));
  }
}
