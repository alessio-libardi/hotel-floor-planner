import { CommonModule } from '@angular/common';
import {
  AfterViewInit,
  Component,
  ElementRef,
  OnDestroy,
  ViewChild,
  signal,
} from '@angular/core';
import Konva from 'konva';
import { firstValueFrom, Subscription, fromEvent } from 'rxjs';
import { FloorPlannerApi } from './floor-planner.api';
import { FloorViewModel } from './floor.models';
import { PlanItem, PlanLayoutStore } from './plan-layout.store';

const GRID_SIZE = 24;

@Component({
  selector: 'app-plan-page',
  imports: [CommonModule],
  templateUrl: './plan-page.component.html',
  styles: [`
    :host { display: block; }
    .plan-page {
      display: grid;
      grid-template-columns: 240px 1fr;
      gap: 12px;
      max-width: 1440px;
      margin: 0 auto;
    }
    .toolbox, .canvas-wrap {
      background: rgba(255, 255, 255, 0.86);
      border: 1px solid rgba(148, 163, 184, 0.24);
      border-radius: 16px;
      box-shadow: 0 10px 28px rgba(15, 23, 42, 0.08);
    }
    .toolbox {
      padding: 12px;
      display: grid;
      gap: 10px;
      align-content: start;
      height: fit-content;
    }
    h2 { margin: 0; font-size: 1rem; }
    .toolbox__actions { display: grid; gap: 8px; }
    .tool {
      border: 0;
      background: #dbeafe;
      color: #1d4ed8;
      border-radius: 10px;
      padding: 8px 10px;
      font: inherit;
      cursor: pointer;
      text-align: left;
    }
    .tool:disabled { opacity: 0.5; cursor: not-allowed; }
    .tool--danger { background: #fee2e2; color: #b91c1c; }
    .toolbox__editor { display: grid; gap: 8px; }
    label { display: grid; gap: 6px; font-size: 0.85rem; color: #475569; }
    input, select {
      border: 1px solid #cbd5e1;
      border-radius: 10px;
      padding: 8px 10px;
      font: inherit;
      background: #fff;
    }
    .helper { margin: 0; color: #64748b; font-size: 0.78rem; }
    .canvas-wrap { padding: 8px; }
    .stage-host {
      width: 100%;
      min-height: 540px;
      border-radius: 12px;
      overflow: hidden;
      background: #f8fafc;
    }
    @media (max-width: 980px) {
      .plan-page { grid-template-columns: 1fr; }
      .stage-host { min-height: 440px; }
    }
  `],
})
export class PlanPageComponent implements AfterViewInit, OnDestroy {
  @ViewChild('stageHost', { static: true })
  private readonly stageHost!: ElementRef<HTMLDivElement>;

  protected readonly selectedItem = signal<PlanItem | null>(null);
  protected roomOptions: Array<{ floorNumber: number; roomNumber: number }> = [];

  private stage: Konva.Stage | null = null;
  private gridLayer: Konva.Layer | null = null;
  private itemLayer: Konva.Layer | null = null;
  private resizeSub: Subscription | null = null;
  private storeSub: Subscription | null = null;

  constructor(
    private readonly store: PlanLayoutStore,
    private readonly api: FloorPlannerApi
  ) {}

  ngAfterViewInit(): void {
    this.initStage();
    this.drawGrid();
    void this.loadRooms();

    this.storeSub = this.store.items$.subscribe(() => {
      this.renderItems();
    });

    this.resizeSub = fromEvent(window, 'resize').subscribe(() => {
      this.resizeStage();
      this.drawGrid();
      this.renderItems();
    });
  }

  ngOnDestroy(): void {
    this.resizeSub?.unsubscribe();
    this.storeSub?.unsubscribe();
    this.stage?.destroy();
  }

  protected async addTable(): Promise<void> {
    const item = await this.store.addItem('table');
    this.selectById(item.id);
  }

  protected async addColumn(): Promise<void> {
    const item = await this.store.addItem('column');
    this.selectById(item.id);
  }

  protected async addLabel(): Promise<void> {
    const item = await this.store.addItem('label');
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
          (item) => item.type === 'table' && item.id !== selected.id && item.roomNumber === roomNumber
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

  protected roomLabel(room: { floorNumber: number; roomNumber: number }): string {
    return `Floor ${room.floorNumber} - Room ${room.roomNumber}`;
  }

  private initStage(): void {
    const host = this.stageHost.nativeElement;
    this.stage = new Konva.Stage({
      container: host,
      width: host.clientWidth,
      height: 560,
    });

    this.gridLayer = new Konva.Layer({ listening: false });
    this.itemLayer = new Konva.Layer();

    this.stage.add(this.gridLayer);
    this.stage.add(this.itemLayer);

    this.stage.on('click', (event) => {
      if (event.target === this.stage) {
        this.selectedItem.set(null);
        this.renderItems();
      }
    });
  }

  private resizeStage(): void {
    if (!this.stage) {
      return;
    }

    this.stage.width(this.stageHost.nativeElement.clientWidth);
    this.stage.height(Math.max(440, this.stageHost.nativeElement.clientHeight));
  }

  private drawGrid(): void {
    if (!this.stage || !this.gridLayer) {
      return;
    }

    this.gridLayer.destroyChildren();

    for (let x = 0; x < this.stage.width(); x += GRID_SIZE) {
      this.gridLayer.add(
        new Konva.Line({
          points: [x, 0, x, this.stage.height()],
          stroke: '#e2e8f0',
          strokeWidth: 1,
        })
      );
    }

    for (let y = 0; y < this.stage.height(); y += GRID_SIZE) {
      this.gridLayer.add(
        new Konva.Line({
          points: [0, y, this.stage.width(), y],
          stroke: '#e2e8f0',
          strokeWidth: 1,
        })
      );
    }

    this.gridLayer.draw();
  }

  private renderItems(): void {
    if (!this.itemLayer) {
      return;
    }

    this.itemLayer.destroyChildren();

    for (const item of this.store.items) {
      const node = this.createNode(item);
      this.itemLayer.add(node);
    }

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
        draggable: true,
      });

      this.wireNodeInteractions(text, item.id);
      return text;
    }

    const group = new Konva.Group({
      id: item.id,
      x: item.x,
      y: item.y,
      draggable: true,
    });

    const rect = new Konva.Rect({
      width: item.width,
      height: item.height,
      cornerRadius: item.type === 'table' ? 12 : 6,
      fill: item.type === 'table' ? '#dbeafe' : '#f1f5f9',
      stroke: selected ? '#2563eb' : '#94a3b8',
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

  private wireNodeInteractions(node: Konva.Node, itemId: string): void {
    node.on('click tap', () => {
      this.selectById(itemId);
    });

    node.on('dragend', () => {
      const x = this.snap(node.x());
      const y = this.snap(node.y());
      node.position({ x, y });
      void this.store.updateItem(itemId, { x, y });
      this.selectById(itemId);
    });
  }

  private async loadRooms(): Promise<void> {
    const floors = await firstValueFrom(this.api.getFloors());
    this.roomOptions = this.extractRooms(floors);
  }

  private extractRooms(floors: FloorViewModel[]): Array<{ floorNumber: number; roomNumber: number }> {
    return floors.flatMap((floor) =>
      floor.rooms.map((room) => ({
        floorNumber: floor.number,
        roomNumber: room.number,
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
}
