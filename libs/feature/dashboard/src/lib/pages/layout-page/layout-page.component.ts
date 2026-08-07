import { CommonModule } from '@angular/common';
import {
  AfterViewInit,
  Component,
  ElementRef,
  OnDestroy,
  ViewChild,
  effect,
  inject,
  signal,
} from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatDialog, MatDialogModule } from '@angular/material/dialog';
import { MatIconModule } from '@angular/material/icon';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { MatToolbarModule } from '@angular/material/toolbar';
import Konva from 'konva';
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
import { formatTableRoomLabel } from '../../room-assignment';
import { TableChainRuleFailure } from '../../table-link-chain';
import {
  ShapeDetailDialogComponent,
  ShapeDetailDialogData,
  ShapeDetailRoomOption,
} from './shape-detail-dialog.component';
import {
  GesturePoint,
  GestureViewport,
  LayoutGestureMachine,
  PinchPoints,
  viewportForPinch,
} from './layout-gesture';
import { LayoutLockService } from './layout-lock.service';
import { LayoutUnlockDialogComponent } from './layout-unlock-dialog.component';

const GRID_SIZE = 24;
const GRID_EXTENT = 6000;
const MIN_SCALE = 0.5;
const MAX_SCALE = 2.6;
const SCALE_STEP = 1.15;
const FOCUS_PADDING = 64;
const MIN_CONTAINER_SIZE = GRID_SIZE;
const LINK_HOLD_DELAY = 450;

@Component({
  selector: 'lib-layout-page',
  imports: [
    CommonModule,
    MatButtonModule,
    MatDialogModule,
    MatIconModule,
    MatSnackBarModule,
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
  private roomOptionsByNumber = new Map<number, ShapeDetailRoomOption>();

  private readonly dialog = inject(MatDialog);
  private readonly snackBar = inject(MatSnackBar);
  private readonly store = inject(PlanLayoutStore);
  private readonly floorStore = inject(FloorStore);
  private readonly layoutLock = inject(LayoutLockService);
  private readonly gestures = new LayoutGestureMachine();
  protected readonly isLayoutLocked = this.layoutLock.locked;

  private viewScale = 1;
  private viewX = 0;
  private viewY = 0;

  private stage: Konva.Stage | null = null;
  private gridLayer: Konva.Layer | null = null;
  private itemLayer: Konva.Layer | null = null;
  private gestureLayer: Konva.Layer | null = null;
  private transformer: Konva.Transformer | null = null;
  private resizeSub: Subscription | null = null;
  private storeSub: Subscription | null = null;
  private floorsSub: Subscription | null = null;
  private hasAutoFocusedInitialItems = false;
  private pointerListeners: AbortController | null = null;
  private linkHoldTimer: ReturnType<typeof setTimeout> | null = null;
  private interactionStartView: {
    x: number;
    y: number;
    scale: number;
  } | null = null;
  private itemGestureStart: {
    itemId: string;
    x: number;
    y: number;
  } | null = null;
  private pinchStart: {
    points: PinchPoints;
    viewport: GestureViewport;
  } | null = null;
  private pinchFrameId: number | null = null;
  private linkSourceId: string | null = null;
  private linkTargetId: string | null = null;
  private linkSourceOutline: Konva.Rect | null = null;
  private linkTargetOutline: Konva.Rect | null = null;
  private linkPreviewLine: Konva.Line | null = null;
  private linkPreviewLabel: Konva.Label | null = null;
  private linkPulseAnimation: Konva.Animation | null = null;

  constructor() {
    effect(() => {
      if (this.isLayoutLocked()) {
        this.disableLayoutEditing();
      }
    });
  }

  ngAfterViewInit(): void {
    this.initStage();
    this.drawGrid();
    void this.floorStore.ensureLoaded();

    this.floorsSub = this.floorStore.floors$.subscribe((floors) => {
      this.roomOptions = this.extractRooms(floors);
      this.roomOptionsByNumber = new Map(
        this.roomOptions.map((room) => [room.roomNumber, room])
      );
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
    this.cancelLinkHold();
    this.cancelPinchUpdate();
    this.linkPulseAnimation?.stop();
    this.pointerListeners?.abort();
    this.floorsSub?.unsubscribe();
    this.resizeSub?.unsubscribe();
    this.storeSub?.unsubscribe();
    this.stage?.destroy();
  }

  protected async addTable(): Promise<void> {
    if (this.isLayoutLocked()) {
      return;
    }

    const item = await this.store.addItem('table');
    this.selectById(item.id);
  }

  protected async addColumn(): Promise<void> {
    if (this.isLayoutLocked()) {
      return;
    }

    const item = await this.store.addItem('column');
    this.selectById(item.id);
  }

  protected async removeSelected(): Promise<void> {
    if (this.isLayoutLocked()) {
      return;
    }

    const selected = this.selectedItem();
    if (!selected) {
      return;
    }

    try {
      await this.store.deleteItem(selected.id);
      this.selectedItem.set(null);
    } catch {
      this.showGestureStatus('Unable to delete this item right now.');
    }
  }

  protected async openSelectedEditor(): Promise<void> {
    if (this.isLayoutLocked()) {
      return;
    }

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

    if (!this.isLayoutLocked()) {
      this.selectById(selected.id);
    }
  }

  protected async toggleLayoutLock(): Promise<void> {
    if (!this.isLayoutLocked()) {
      this.layoutLock.setLocked(true);
      this.showGestureStatus('Layout locked.');
      return;
    }

    const dialogRef = this.dialog.open<
      LayoutUnlockDialogComponent,
      void,
      boolean
    >(LayoutUnlockDialogComponent, {
      width: '420px',
      maxWidth: '90vw',
      restoreFocus: true,
    });
    const confirmed = await firstValueFrom(dialogRef.afterClosed());

    if (confirmed) {
      this.layoutLock.setLocked(false);
      this.showGestureStatus('Layout editing enabled.');
    }
  }

  private disableLayoutEditing(): void {
    this.cancelPinchUpdate();
    this.cancelLinkHold();
    this.restoreItemGesturePosition();
    this.clearLinkFeedback();
    this.gestures.cancelAll();
    this.finishPointerInteraction();
    this.selectedItem.set(null);
    this.transformer?.nodes([]);
    this.renderItems();
    this.dialog.closeAll();
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

  private initStage(): void {
    const host = this.stageHost.nativeElement;
    this.stage = new Konva.Stage({
      container: host,
      width: host.clientWidth,
      height: host.clientHeight,
    });

    this.gridLayer = new Konva.Layer({ listening: false });
    this.itemLayer = new Konva.Layer();
    this.gestureLayer = new Konva.Layer({ listening: false });
    this.transformer = new Konva.Transformer({
      rotateEnabled: false,
      enabledAnchors: ['top-left', 'top-right', 'bottom-left', 'bottom-right'],
      keepRatio: true,
      centeredScaling: false,
      borderStroke: '#2563eb',
      borderStrokeWidth: 1,
      anchorSize: 18,
      anchorStroke: '#2563eb',
      anchorFill: '#dbeafe',
      anchorCornerRadius: 2,
    });
    this.transformer.on('transformend', () => {
      void this.commitContainerResize();
    });

    this.stage.add(this.gridLayer);
    this.stage.add(this.itemLayer);
    this.stage.add(this.gestureLayer);
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

    this.bindPointerGestures();
  }

  private bindPointerGestures(): void {
    if (!this.stage) {
      return;
    }

    const content = this.stage.getContent();
    this.pointerListeners?.abort();
    this.pointerListeners = new AbortController();
    const options = {
      passive: false,
      signal: this.pointerListeners.signal,
    } as AddEventListenerOptions;

    content.style.cursor = 'default';
    content.addEventListener(
      'pointerdown',
      (event) => this.onPointerDown(event),
      options
    );
    content.addEventListener(
      'pointermove',
      (event) => this.onPointerMove(event),
      options
    );
    content.addEventListener(
      'pointerup',
      (event) => this.onPointerUp(event),
      options
    );
    content.addEventListener(
      'pointercancel',
      (event) => this.onPointerCancel(event),
      options
    );
    content.addEventListener(
      'lostpointercapture',
      (event) => this.onPointerCancel(event),
      options
    );
  }

  private onPointerDown(event: PointerEvent): void {
    if (!this.stage || (event.pointerType === 'mouse' && event.button !== 0)) {
      return;
    }

    const point = this.pointerPoint(event);
    const hit = this.stage.getIntersection(point);
    if (this.isTransformerTarget(hit)) {
      return;
    }

    event.preventDefault();

    if (this.gestures.pointerCount === 0) {
      this.interactionStartView = {
        x: this.viewX,
        y: this.viewY,
        scale: this.viewScale,
      };
    }

    const item = this.isLayoutLocked() ? null : this.itemFromNode(hit);
    const previousState = this.gestures.state;
    const state = this.gestures.begin(
      event.pointerId,
      point,
      item
        ? {
            kind: 'item',
            itemId: item.id,
            canLink: item.type === 'table',
          }
        : { kind: 'canvas' }
    );

    try {
      this.stage.getContent().setPointerCapture(event.pointerId);
    } catch {
      // Pointer capture is an enhancement; window-bound pointer events still work.
    }

    if (state === 'pinch') {
      this.cancelLinkHold();
      if (previousState !== 'pinch') {
        if (previousState === 'item-move') {
          this.restoreItemGesturePosition();
        }
        this.clearLinkFeedback();
        this.startPinch();
      }
      return;
    }

    if (item) {
      this.itemGestureStart = {
        itemId: item.id,
        x: item.x,
        y: item.y,
      };

      if (item.type === 'table') {
        this.startLinkHold(event.pointerId, item.id);
      }
    }
  }

  private onPointerMove(event: PointerEvent): void {
    if (!this.stage) {
      return;
    }

    const point = this.pointerPoint(event);

    if (this.gestures.pointerCount === 0) {
      const item = this.itemAtPoint(point);
      this.stage.getContent().style.cursor =
        !this.isLayoutLocked() && item ? 'pointer' : 'default';
      return;
    }

    event.preventDefault();
    const previousState = this.gestures.state;
    const state = this.gestures.move(event.pointerId, point);

    if (state === 'pinch') {
      this.schedulePinchUpdate();
      return;
    }

    if (state === 'item-move') {
      if (previousState !== 'item-move') {
        this.cancelLinkHold();
      }
      this.moveGestureItem(point);
      this.stage.getContent().style.cursor = 'grabbing';
      return;
    }

    if (state === 'link-drag') {
      this.updateLinkFeedback(point);
    }
  }

  private onPointerUp(event: PointerEvent): void {
    if (!this.stage || this.gestures.pointerCount === 0) {
      return;
    }

    event.preventDefault();
    const point = this.pointerPoint(event);
    if (this.gestures.state === 'pinch') {
      this.gestures.move(event.pointerId, point);
      this.flushPinchUpdate();
    }
    const ended = this.gestures.end(event.pointerId, point);
    if (!ended) {
      return;
    }

    this.cancelLinkHold();

    if (ended.state === 'pinch') {
      if (this.gestures.pointerCount === 0) {
        this.finishPointerInteraction();
      }
      return;
    }

    if (ended.state === 'link-drag') {
      this.updateLinkFeedback(point);
      const sourceId = this.linkSourceId;
      const targetId = this.linkTargetId;
      this.clearLinkFeedback();
      this.finishPointerInteraction();

      if (sourceId && targetId) {
        void this.toggleLinkBetweenTables(sourceId, targetId).catch(() => {
          this.showGestureStatus('Unable to update the table link.');
        });
      }
      return;
    }

    if (ended.state === 'item-move') {
      void this.commitGestureItemMove().catch(() => {
        this.showGestureStatus('Unable to move this item.');
        this.renderItems();
      });
      this.finishPointerInteraction();
      return;
    }

    if (ended.target?.kind === 'item' && ended.target.itemId) {
      this.selectById(ended.target.itemId);
      void this.openSelectedEditor();
    } else {
      this.selectedItem.set(null);
      this.renderItems();
    }

    this.finishPointerInteraction();
  }

  private onPointerCancel(event: PointerEvent): void {
    if (!this.gestures.hasPointer(event.pointerId)) {
      return;
    }

    event.preventDefault();
    this.cancelPinchUpdate();
    this.cancelLinkHold();
    this.restoreItemGesturePosition();
    this.clearLinkFeedback();

    if (this.interactionStartView) {
      this.viewX = this.interactionStartView.x;
      this.viewY = this.interactionStartView.y;
      this.viewScale = this.interactionStartView.scale;
      this.applyViewportTransform();
    }

    this.gestures.cancelAll();
    this.finishPointerInteraction();
  }

  private startLinkHold(pointerId: number, itemId: string): void {
    if (this.isLayoutLocked()) {
      return;
    }

    this.cancelLinkHold();
    this.linkHoldTimer = setTimeout(() => {
      this.linkHoldTimer = null;
      if (!this.gestures.activateLink(pointerId)) {
        return;
      }

      const point = this.gestures.primaryPoint();
      if (!point) {
        return;
      }

      this.beginLinkFeedback(itemId, point);
    }, LINK_HOLD_DELAY);
  }

  private cancelLinkHold(): void {
    if (this.linkHoldTimer != null) {
      clearTimeout(this.linkHoldTimer);
      this.linkHoldTimer = null;
    }
  }

  private startPinch(): void {
    const points = this.gestures.pinchPoints();
    if (!points) {
      return;
    }

    this.cancelPinchUpdate();
    this.pinchStart = {
      points: [{ ...points[0] }, { ...points[1] }],
      viewport: {
        x: this.viewX,
        y: this.viewY,
        scale: this.viewScale,
      },
    };
    if (this.stage) {
      this.stage.getContent().style.cursor = 'grabbing';
    }
  }

  private schedulePinchUpdate(): void {
    if (this.pinchFrameId != null) {
      return;
    }

    this.pinchFrameId = requestAnimationFrame(() => {
      this.pinchFrameId = null;
      this.applyPinchUpdate();
    });
  }

  private flushPinchUpdate(): void {
    this.cancelPinchUpdate();
    this.applyPinchUpdate();
  }

  private applyPinchUpdate(): void {
    const points = this.gestures.pinchPoints();
    if (!points || !this.pinchStart) {
      return;
    }

    const viewport = viewportForPinch(
      this.pinchStart.viewport,
      this.pinchStart.points,
      points,
      MIN_SCALE,
      MAX_SCALE
    );

    this.viewX = viewport.x;
    this.viewY = viewport.y;
    this.viewScale = viewport.scale;
    this.applyViewportTransform();
  }

  private cancelPinchUpdate(): void {
    if (this.pinchFrameId != null) {
      cancelAnimationFrame(this.pinchFrameId);
      this.pinchFrameId = null;
    }
  }

  private moveGestureItem(point: GesturePoint): void {
    const start = this.gestures.primaryStart();
    const itemStart = this.itemGestureStart;
    if (!start || !itemStart) {
      return;
    }

    const node = this.findItemNode(itemStart.itemId);
    if (!node) {
      return;
    }

    node.position({
      x: this.snap(itemStart.x + (point.x - start.x) / this.viewScale),
      y: this.snap(itemStart.y + (point.y - start.y) / this.viewScale),
    });
    this.itemLayer?.batchDraw();
  }

  private async commitGestureItemMove(): Promise<void> {
    const itemStart = this.itemGestureStart;
    if (!itemStart) {
      return;
    }

    if (this.isLayoutLocked()) {
      this.restoreItemGesturePosition();
      return;
    }

    const node = this.findItemNode(itemStart.itemId);
    if (!node) {
      return;
    }

    const x = this.snap(node.x());
    const y = this.snap(node.y());
    node.position({ x, y });
    await this.store.updateItem(itemStart.itemId, { x, y });
    this.selectById(itemStart.itemId);
  }

  private restoreItemGesturePosition(): void {
    if (!this.itemGestureStart) {
      return;
    }

    const node = this.findItemNode(this.itemGestureStart.itemId);
    node?.position({
      x: this.itemGestureStart.x,
      y: this.itemGestureStart.y,
    });
    this.itemLayer?.batchDraw();
  }

  private finishPointerInteraction(): void {
    this.cancelPinchUpdate();
    this.interactionStartView = null;
    this.itemGestureStart = null;
    this.pinchStart = null;
    if (this.stage) {
      this.stage.getContent().style.cursor = 'default';
    }
  }

  private pointerPoint(event: PointerEvent): GesturePoint {
    if (!this.stage) {
      return { x: 0, y: 0 };
    }

    const bounds = this.stage.getContent().getBoundingClientRect();
    return {
      x: event.clientX - bounds.left,
      y: event.clientY - bounds.top,
    };
  }

  private beginLinkFeedback(sourceId: string, point: GesturePoint): void {
    if (this.isLayoutLocked()) {
      this.gestures.cancelAll();
      return;
    }

    const source = this.store.items.find(
      (item) => item.id === sourceId && item.type === 'table'
    );
    if (!source || !this.gestureLayer) {
      this.gestures.cancelAll();
      return;
    }

    this.clearLinkFeedback();
    this.linkSourceId = sourceId;
    this.linkSourceOutline = new Konva.Rect({
      x: source.x - 6,
      y: source.y - 6,
      width: source.width + 12,
      height: source.height + 12,
      cornerRadius: 18,
      stroke: '#f59e0b',
      strokeWidth: 4,
      dash: [8, 5],
      listening: false,
    });
    this.linkPreviewLine = new Konva.Line({
      points: [...this.tableCenter(source), ...this.screenToWorld(point)],
      stroke: '#f59e0b',
      strokeWidth: 4,
      dash: [10, 7],
      lineCap: 'round',
      listening: false,
    });
    this.linkTargetOutline = new Konva.Rect({
      visible: false,
      strokeWidth: 4,
      cornerRadius: 18,
      listening: false,
    });
    this.linkPreviewLabel = new Konva.Label({ listening: false });
    this.linkPreviewLabel.add(
      new Konva.Tag({
        fill: '#7c2d12',
        cornerRadius: 6,
        pointerDirection: 'left',
        pointerWidth: 8,
        pointerHeight: 8,
      })
    );
    this.linkPreviewLabel.add(
      new Konva.Text({
        text: 'Drag to another table',
        fontSize: 14,
        fontStyle: 'bold',
        padding: 7,
        fill: '#ffffff',
        listening: false,
      })
    );

    this.gestureLayer.add(
      this.linkPreviewLine,
      this.linkSourceOutline,
      this.linkTargetOutline,
      this.linkPreviewLabel
    );
    this.linkPulseAnimation = new Konva.Animation((frame) => {
      if (!this.linkSourceOutline || !frame) {
        return;
      }

      this.linkSourceOutline.opacity(0.62 + Math.sin(frame.time / 115) * 0.28);
    }, this.gestureLayer);
    this.linkPulseAnimation.start();
    this.stage?.getContent().style.setProperty('cursor', 'crosshair');
    this.updateLinkFeedback(point);
  }

  private updateLinkFeedback(point: GesturePoint): void {
    if (
      !this.linkSourceId ||
      !this.linkPreviewLine ||
      !this.linkPreviewLabel ||
      !this.linkTargetOutline
    ) {
      return;
    }

    const source = this.store.items.find(
      (item) => item.id === this.linkSourceId && item.type === 'table'
    );
    if (!source) {
      this.clearLinkFeedback();
      return;
    }

    const [worldX, worldY] = this.screenToWorld(point);
    const candidate = this.itemAtPoint(point);
    const validTarget =
      candidate?.type === 'table' && candidate.id !== source.id
        ? candidate
        : null;
    const linkChange = validTarget
      ? this.store.tableChainChange(source.id, validTarget.id)
      : null;
    const linkBlocked = linkChange != null && !linkChange.ok;
    const willUnlink = linkChange?.ok && linkChange.action === 'unlink';
    const color =
      willUnlink || linkBlocked
        ? '#dc2626'
        : validTarget
          ? '#16a34a'
          : '#f59e0b';
    const label = linkBlocked
      ? this.tableChainRuleLabel(linkChange.reason)
      : willUnlink
        ? 'Unlink'
        : validTarget
          ? 'Link'
          : candidate
            ? candidate.id === source.id
              ? 'Choose another table'
              : 'Tables only'
            : 'Drag to another table';

    this.linkTargetId = validTarget?.id ?? null;
    this.linkPreviewLine.points([...this.tableCenter(source), worldX, worldY]);
    this.linkPreviewLine.stroke(color);
    this.linkPreviewLabel.position({
      x: worldX + 12 / this.viewScale,
      y: worldY,
    });
    this.linkPreviewLabel.scale({
      x: 1 / this.viewScale,
      y: 1 / this.viewScale,
    });
    const labelText = this.linkPreviewLabel.findOne('Text');
    const labelTag = this.linkPreviewLabel.findOne('Tag');
    if (labelText instanceof Konva.Text) {
      labelText.text(label);
    }
    if (labelTag instanceof Konva.Tag) {
      labelTag.fill(color);
    }

    if (candidate && candidate.id !== source.id) {
      this.linkTargetOutline.setAttrs({
        x: candidate.x - 6,
        y: candidate.y - 6,
        width: candidate.width + 12,
        height: candidate.height + 12,
        stroke: validTarget ? color : '#dc2626',
        dash: validTarget ? [] : [8, 5],
        visible: true,
      });
    } else {
      this.linkTargetOutline.visible(false);
    }

    this.gestureLayer?.batchDraw();
  }

  private clearLinkFeedback(): void {
    this.linkPulseAnimation?.stop();
    this.linkPulseAnimation = null;
    this.gestureLayer?.destroyChildren();
    this.gestureLayer?.draw();
    this.linkSourceId = null;
    this.linkTargetId = null;
    this.linkSourceOutline = null;
    this.linkTargetOutline = null;
    this.linkPreviewLine = null;
    this.linkPreviewLabel = null;
  }

  private screenToWorld(point: GesturePoint): [number, number] {
    return [
      (point.x - this.viewX) / this.viewScale,
      (point.y - this.viewY) / this.viewScale,
    ];
  }

  private itemAtPoint(point: GesturePoint): PlanItem | null {
    return this.stage
      ? this.itemFromNode(this.stage.getIntersection(point))
      : null;
  }

  private itemFromNode(node: Konva.Node | null): PlanItem | null {
    let current: Konva.Node | null = node;

    while (current && current !== this.stage) {
      const itemId = current.id();
      const item = this.store.items.find((entry) => entry.id === itemId);
      if (item) {
        return item;
      }
      current = current.getParent();
    }

    return null;
  }

  private isTransformerTarget(node: Konva.Node | null): boolean {
    let current: Konva.Node | null = node;
    while (current) {
      if (current === this.transformer) {
        return true;
      }
      current = current.getParent();
    }
    return false;
  }

  private findItemNode(itemId: string): Konva.Node | null {
    if (!this.itemLayer) {
      return null;
    }

    return (
      this.itemLayer.getChildren().find((child) => child.id() === itemId) ??
      null
    );
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
        draggable: false,
        listening: true,
      });

      return text;
    }

    const group = new Konva.Group({
      id: item.id,
      x: item.x,
      y: item.y,
      draggable: false,
      listening: true,
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
          text: item.displayTableNumber ?? '?',
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

  private extractRooms(floors: FloorViewModel[]): ShapeDetailRoomOption[] {
    return floors.flatMap((floor) =>
      floor.rooms.map((room) => ({
        floorId: floor.id,
        floorNumber: floor.number,
        roomId: room.id,
        roomNumber: room.number,
        arrivalDate: room.arrivalDate,
        departureDate: room.departureDate,
        note: room.note,
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
    if (this.isLayoutLocked() || !this.itemLayer || !this.transformer) {
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
    if (this.isLayoutLocked() || !this.itemLayer || !this.transformer) {
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
    return (
      item.type === 'table' &&
      item.roomNumbers.some(
        (roomNumber) =>
          (this.roomOptionsByNumber.get(roomNumber)?.note ?? '').trim().length >
          0
      )
    );
  }

  private assignedRoomStatus(roomNumbers: number[]): RoomDepartureStatus {
    if (roomNumbers.length === 0) {
      return 'none';
    }

    let status: RoomDepartureStatus = 'none';

    for (const roomNumber of roomNumbers) {
      const room = this.roomOptionsByNumber.get(roomNumber);
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

  private async toggleLinkBetweenTables(
    sourceTableId: string,
    targetTableId: string
  ): Promise<void> {
    if (this.isLayoutLocked()) {
      return;
    }

    const source = this.store.items.find(
      (item) => item.id === sourceTableId && item.type === 'table'
    );
    const target = this.store.items.find(
      (item) => item.id === targetTableId && item.type === 'table'
    );

    if (!source || !target) {
      this.showGestureStatus('Could not find one of the selected tables.');
      return;
    }

    const change = this.store.tableChainChange(source.id, target.id);
    if (!change.ok) {
      this.showGestureStatus(this.tableChainRuleMessage(change.reason));
      return;
    }

    const action = await this.store.toggleTableLink(source.id, target.id);

    const refreshedSource = this.store.items.find(
      (item) => item.id === source.id
    );
    if (refreshedSource) {
      this.selectedItem.set(refreshedSource);
    }

    this.showGestureStatus(
      action === 'unlink' ? 'Tables unlinked.' : 'Tables linked.'
    );
    this.renderItems();
  }

  private tableChainRuleLabel(reason: TableChainRuleFailure): string {
    switch (reason) {
      case 'source-middle':
      case 'target-middle':
        return 'Link from a chain end';
      case 'same-group':
        return 'Already in this group';
      case 'table-not-found':
        return 'Choose another table';
    }
  }

  private tableChainRuleMessage(reason: TableChainRuleFailure): string {
    switch (reason) {
      case 'source-middle':
      case 'target-middle':
        return 'Tables can only be linked from chain ends.';
      case 'same-group':
        return 'These tables are already in the same linked group.';
      case 'table-not-found':
        return 'Could not find one of the selected tables.';
    }
  }

  private showGestureStatus(message: string): void {
    this.snackBar.open(message, undefined, {
      duration: 2400,
      horizontalPosition: 'center',
      verticalPosition: 'bottom',
      politeness: 'polite',
    });
  }

  private clamp(value: number, min: number, max: number): number {
    return Math.max(min, Math.min(max, value));
  }
}
