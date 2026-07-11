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
  getRoomDepartureStatus,
  RoomDepartureStatus,
  TOMORROW_HIGHLIGHT_BACKGROUND,
  TOMORROW_HIGHLIGHT_FOREGROUND,
} from '../../room-departure-status';
import {
  compareTableNumbers,
  nextGeneratedTableNumber,
} from '../../table-number';
import { formatTableRoomLabel } from '../../room-assignment';
import {
  ShapeDetailDialogComponent,
  ShapeDetailDialogData,
  ShapeDetailRoomOption,
} from './shape-detail-dialog.component';

const GRID_SIZE = 24;
const GRID_EXTENT = 6000;
const MIN_SCALE = 0.5;
const MAX_SCALE = 2.6;
const SCALE_STEP = 1.15;
const FOCUS_PADDING = 64;
const MIN_CONTAINER_SIZE = GRID_SIZE;
const MAX_TABLE_LINKS = 2;

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
  protected roomOptions: ShapeDetailRoomOption[] = [];
  protected readonly isPanMode = signal(true);
  protected readonly isLinkMode = signal(false);
  protected readonly linkModeStatus = signal<string>('');

  private readonly linkSourceTableId = signal<string | null>(null);

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
      ShapeDetailDialogComponent,
      ShapeDetailDialogData
    >(ShapeDetailDialogComponent, {
      width: '600px',
      maxWidth: '90vw',
      data: {
        item: selected,
        roomOptions: this.roomOptions,
      },
    });

    await firstValueFrom(dialogRef.afterClosed());

    this.selectById(selected.id);
  }

  protected currentModeLabel(): string {
    if (this.isLinkMode()) {
      return 'Link mode';
    }

    return this.isPanMode() ? 'Pan mode' : 'Edit mode';
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
    if (this.isPanMode() === enabled && (!enabled || !this.isLinkMode())) {
      return;
    }

    if (enabled) {
      this.isLinkMode.set(false);
      this.linkSourceTableId.set(null);
      this.linkModeStatus.set('');
    }

    this.isPanMode.set(enabled);
    this.updateCanvasInteractionMode();
    this.renderItems();
  }

  protected setLinkMode(enabled: boolean): void {
    if (this.isLinkMode() === enabled) {
      return;
    }

    this.isLinkMode.set(enabled);

    if (enabled) {
      this.isPanMode.set(false);
      this.linkModeStatus.set('Select the first table to start linking.');
    } else {
      this.linkSourceTableId.set(null);
      this.linkModeStatus.set('');
    }

    this.updateCanvasInteractionMode();
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

        if (this.isLinkMode()) {
          this.linkSourceTableId.set(null);
          this.linkModeStatus.set('Select a table to start linking.');
        }

        this.renderItems();
      }
    });

    this.updateCanvasInteractionMode();
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

    if (item.type === 'column') {
      group.add(
        new Konva.Text({
          x: 0,
          y: item.height / 2 - 8,
          width: item.width,
          align: 'center',
          text: item.text,
          fontSize: 14,
          fill: this.itemTextColor(item),
          listening: false,
        })
      );
    }

    if (item.type === 'table') {
      group.add(
        new Konva.Text({
          x: 8,
          y: 7,
          text: item.tableNumber ?? '?',
          fontSize: 11,
          fontStyle: 'bold',
          fill: this.itemTextColor(item),
          listening: false,
        })
      );

      group.add(
        new Konva.Text({
          x: 0,
          y: item.height / 2 - 8,
          width: item.width,
          align: 'center',
          text: this.tableRoomLabel(item.roomNumbers),
          fontSize: 13,
          fill: this.itemTextColor(item),
          listening: false,
        })
      );

      if (this.hasTableNote(item)) {
        group.add(
          new Konva.Circle({
            x: item.width - 12,
            y: 12,
            radius: 7,
            fill: '#f59e0b',
            listening: false,
          })
        );

        group.add(
          new Konva.Text({
            x: item.width - 17,
            y: 6,
            width: 10,
            align: 'center',
            text: '!',
            fontSize: 11,
            fontStyle: 'bold',
            fill: '#ffffff',
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
    const linkSourceId = this.linkSourceTableId();

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
          selectedId === table.id ||
          selectedId === linkedTable.id ||
          linkSourceId === table.id ||
          linkSourceId === linkedTable.id;

        this.itemLayer.add(
          new Konva.Line({
            points: [startX, startY, endX, endY],
            stroke: highlighted
              ? this.isLinkMode()
                ? '#f59e0b'
                : '#2563eb'
              : '#94a3b8',
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
    let draggedInCurrentGesture = false;

    if (!this.isPanMode() && !this.isLinkMode()) {
      node.dragBoundFunc((position) => ({
        x: this.snap(position.x),
        y: this.snap(position.y),
      }));
    }

    node.on('dragstart', () => {
      if (this.isPanMode()) {
        return;
      }

      draggedInCurrentGesture = true;
    });

    node.on('click tap', () => {
      if (this.isPanMode()) {
        return;
      }

      if (this.isLinkMode()) {
        void this.handleLinkModeNodeClick(itemId);
        return;
      }

      if (draggedInCurrentGesture) {
        draggedInCurrentGesture = false;
        return;
      }

      this.selectById(itemId);
      void this.openSelectedEditor();
    });

    node.on('dragend', () => {
      if (this.isPanMode() || this.isLinkMode()) {
        return;
      }

      const x = this.snap(node.x());
      const y = this.snap(node.y());
      node.position({ x, y });
      void this.store.updateItem(itemId, { x, y });
      this.selectById(itemId);
      draggedInCurrentGesture = false;
    });
  }

  private extractRooms(floors: FloorViewModel[]): ShapeDetailRoomOption[] {
    return floors.flatMap((floor) =>
      floor.rooms.map((room) => ({
        floorId: floor.id,
        floorNumber: floor.number,
        roomId: room.id,
        roomNumber: room.number,
        arrivalDate: room.arrivalDate,
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
    if (item.type === 'table') {
      const status = this.assignedRoomStatus(item.roomNumbers);

      if (status === 'expired') {
        return '#fee2e2';
      }

      if (status === 'tomorrow') {
        return TOMORROW_HIGHLIGHT_BACKGROUND;
      }
    }

    return item.type === 'table' ? '#dbeafe' : '#f1f5f9';
  }

  private itemTextColor(item: PlanItem): string {
    if (item.type !== 'table') {
      return '#0f172a';
    }

    const status = this.assignedRoomStatus(item.roomNumbers);
    return status === 'tomorrow' ? TOMORROW_HIGHLIGHT_FOREGROUND : '#0f172a';
  }

  private tableRoomLabel(roomNumbers: number[]): string {
    return formatTableRoomLabel(roomNumbers);
  }

  private hasTableNote(item: PlanItem): boolean {
    return item.type === 'table' && item.text.trim().length > 0;
  }

  private assignedRoomStatus(roomNumbers: number[]): RoomDepartureStatus {
    if (roomNumbers.length === 0) {
      return 'none';
    }

    let status: RoomDepartureStatus = 'none';

    for (const roomNumber of roomNumbers) {
      const room = this.roomOptions.find(
        (entry) => entry.roomNumber === roomNumber
      );
      const nextStatus = getRoomDepartureStatus(room?.departureDate ?? null);

      if (nextStatus === 'expired') {
        return 'expired';
      }

      if (nextStatus === 'tomorrow') {
        status = 'tomorrow';
      }
    }

    return status;
  }

  private async syncLinkedTableNumbers(anchorTableId: string): Promise<void> {
    const tables = this.store.items.filter((item) => item.type === 'table');
    if (tables.length === 0) {
      return;
    }

    const components = this.getTableLinkComponents(tables);
    let nextTableNumber = Number(
      nextGeneratedTableNumber(tables.map((table) => table.tableNumber))
    );
    const usedNumbers = new Set<string>();
    const updates: Array<Promise<void>> = [];

    const orderedComponents = [...components].sort((left, right) => {
      const leftHasAnchor = left.some((table) => table.id === anchorTableId);
      const rightHasAnchor = right.some((table) => table.id === anchorTableId);

      if (leftHasAnchor !== rightHasAnchor) {
        return leftHasAnchor ? -1 : 1;
      }

      const leftNumbers = left
        .map((table) => table.tableNumber)
        .filter((tableNumber): tableNumber is string => tableNumber != null);
      const rightNumbers = right
        .map((table) => table.tableNumber)
        .filter((tableNumber): tableNumber is string => tableNumber != null);

      const leftMinNumber =
        leftNumbers.length > 0
          ? [...leftNumbers].sort(compareTableNumbers)[0]
          : null;
      const rightMinNumber =
        rightNumbers.length > 0
          ? [...rightNumbers].sort(compareTableNumbers)[0]
          : null;

      if (leftMinNumber != null && rightMinNumber != null) {
        if (leftMinNumber !== rightMinNumber) {
          return compareTableNumbers(leftMinNumber, rightMinNumber);
        }
      }

      return left[0].id.localeCompare(right[0].id);
    });

    for (const component of orderedComponents) {
      const existingNumbers = component
        .map((table) => table.tableNumber)
        .filter((tableNumber): tableNumber is string => tableNumber != null)
        .sort(compareTableNumbers);

      let targetNumber = existingNumbers.find(
        (tableNumber) => !usedNumbers.has(tableNumber)
      );

      if (targetNumber == null) {
        targetNumber = `${nextTableNumber}`;
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

  private async handleLinkModeNodeClick(itemId: string): Promise<void> {
    const item = this.store.items.find((entry) => entry.id === itemId);

    if (!item || item.type !== 'table') {
      this.linkModeStatus.set('Only tables can be linked.');
      return;
    }

    const sourceId = this.linkSourceTableId();

    if (!sourceId) {
      this.linkSourceTableId.set(item.id);
      this.selectedItem.set(item);
      this.linkModeStatus.set(
        'Select another table to link or unlink with this source.'
      );
      this.renderItems();
      return;
    }

    if (sourceId === item.id) {
      this.linkSourceTableId.set(null);
      this.linkModeStatus.set('Source cleared. Select a table to start again.');
      this.renderItems();
      return;
    }

    await this.toggleLinkBetweenTables(sourceId, item.id);
  }

  private async toggleLinkBetweenTables(
    sourceTableId: string,
    targetTableId: string
  ): Promise<void> {
    const source = this.store.items.find(
      (item) => item.id === sourceTableId && item.type === 'table'
    );
    const target = this.store.items.find(
      (item) => item.id === targetTableId && item.type === 'table'
    );

    if (!source || !target) {
      this.linkModeStatus.set('Could not find one of the selected tables.');
      return;
    }

    const currentlyLinked = source.linkedTableIds.includes(target.id);

    if (!currentlyLinked) {
      if (source.linkedTableIds.length >= MAX_TABLE_LINKS) {
        this.linkModeStatus.set('Source table already has 2 linked tables.');
        return;
      }

      if (target.linkedTableIds.length >= MAX_TABLE_LINKS) {
        this.linkModeStatus.set('Target table already has 2 linked tables.');
        return;
      }
    }

    const nextSourceLinks = currentlyLinked
      ? source.linkedTableIds.filter((entry) => entry !== target.id)
      : [...source.linkedTableIds, target.id];
    const nextTargetLinks = currentlyLinked
      ? target.linkedTableIds.filter((entry) => entry !== source.id)
      : [...target.linkedTableIds, source.id];

    await this.store.updateItem(source.id, {
      linkedTableIds: this.uniqueLinkIds(nextSourceLinks),
    });
    await this.store.updateItem(target.id, {
      linkedTableIds: this.uniqueLinkIds(nextTargetLinks),
    });

    await this.syncLinkedTableNumbers(source.id);

    const refreshedSource = this.store.items.find(
      (item) => item.id === source.id
    );
    if (refreshedSource) {
      this.selectedItem.set(refreshedSource);
    }

    this.linkSourceTableId.set(source.id);
    this.linkModeStatus.set(
      currentlyLinked ? 'Tables unlinked.' : 'Tables linked.'
    );
    this.renderItems();
  }

  private updateCanvasInteractionMode(): void {
    if (!this.stage) {
      return;
    }

    const panEnabled = this.isPanMode();
    const linkMode = this.isLinkMode();
    this.stage.draggable(panEnabled);
    this.stage.container().style.cursor = panEnabled
      ? 'grab'
      : linkMode
        ? 'crosshair'
        : 'default';

    if (panEnabled) {
      this.selectedItem.set(null);
    }

    if (!panEnabled || linkMode) {
      this.stage.stopDrag();
    }
  }

  private clamp(value: number, min: number, max: number): number {
    return Math.max(min, Math.min(max, value));
  }
}
