export const GESTURE_MOVE_THRESHOLD = 10;

export type LayoutGestureState =
  | 'idle'
  | 'pan'
  | 'item-move'
  | 'pinch'
  | 'link-arming'
  | 'link-drag';

export interface GesturePoint {
  x: number;
  y: number;
}

export interface GestureTarget {
  kind: 'canvas' | 'item';
  itemId?: string;
  canLink?: boolean;
}

interface TrackedPointer {
  start: GesturePoint;
  current: GesturePoint;
}

export interface EndedGesture {
  state: LayoutGestureState;
  target: GestureTarget | null;
  start: GesturePoint | null;
  end: GesturePoint;
}

export type TableLinkChange =
  | {
      ok: true;
      action: 'link' | 'unlink';
      sourceLinks: string[];
      targetLinks: string[];
    }
  | {
      ok: false;
      reason: 'same-table' | 'source-full' | 'target-full';
    };

export class LayoutGestureMachine {
  private readonly pointers = new Map<number, TrackedPointer>();
  private primaryPointerId: number | null = null;
  private primaryTarget: GestureTarget | null = null;

  state: LayoutGestureState = 'idle';

  get pointerCount(): number {
    return this.pointers.size;
  }

  hasPointer(pointerId: number): boolean {
    return this.pointers.has(pointerId);
  }

  begin(
    pointerId: number,
    point: GesturePoint,
    target: GestureTarget
  ): LayoutGestureState {
    this.pointers.set(pointerId, { start: point, current: point });

    if (this.pointers.size >= 2) {
      this.state = 'pinch';
      return this.state;
    }

    this.primaryPointerId = pointerId;
    this.primaryTarget = target;
    this.state =
      target.kind === 'item' && target.canLink ? 'link-arming' : 'idle';
    return this.state;
  }

  move(pointerId: number, point: GesturePoint): LayoutGestureState {
    const pointer = this.pointers.get(pointerId);
    if (!pointer) {
      return this.state;
    }

    pointer.current = point;

    if (this.state === 'pinch' || this.state === 'link-drag') {
      return this.state;
    }

    if (pointerId !== this.primaryPointerId) {
      return this.state;
    }

    if (distanceBetween(pointer.start, point) < GESTURE_MOVE_THRESHOLD) {
      return this.state;
    }

    this.state = this.primaryTarget?.kind === 'item' ? 'item-move' : 'pan';
    return this.state;
  }

  activateLink(pointerId: number): boolean {
    const pointer = this.pointers.get(pointerId);
    if (
      !pointer ||
      pointerId !== this.primaryPointerId ||
      this.pointers.size !== 1 ||
      this.state !== 'link-arming' ||
      distanceBetween(pointer.start, pointer.current) >= GESTURE_MOVE_THRESHOLD
    ) {
      return false;
    }

    this.state = 'link-drag';
    return true;
  }

  end(pointerId: number, point: GesturePoint): EndedGesture | null {
    const pointer = this.pointers.get(pointerId);
    if (!pointer) {
      return null;
    }

    const ended: EndedGesture = {
      state: this.state,
      target: this.primaryTarget,
      start: pointerId === this.primaryPointerId ? pointer.start : null,
      end: point,
    };

    this.pointers.delete(pointerId);

    if (this.state === 'pinch') {
      if (this.pointers.size === 0) {
        this.reset();
      }
      return ended;
    }

    this.reset();
    return ended;
  }

  cancelAll(): void {
    this.reset();
  }

  points(): GesturePoint[] {
    return [...this.pointers.values()].map((pointer) => pointer.current);
  }

  primaryPoint(): GesturePoint | null {
    if (this.primaryPointerId == null) {
      return null;
    }

    return this.pointers.get(this.primaryPointerId)?.current ?? null;
  }

  primaryStart(): GesturePoint | null {
    if (this.primaryPointerId == null) {
      return null;
    }

    return this.pointers.get(this.primaryPointerId)?.start ?? null;
  }

  private reset(): void {
    this.pointers.clear();
    this.primaryPointerId = null;
    this.primaryTarget = null;
    this.state = 'idle';
  }
}

export function distanceBetween(
  left: GesturePoint,
  right: GesturePoint
): number {
  return Math.hypot(right.x - left.x, right.y - left.y);
}

export function midpoint(
  left: GesturePoint,
  right: GesturePoint
): GesturePoint {
  return {
    x: (left.x + right.x) / 2,
    y: (left.y + right.y) / 2,
  };
}

export function tableLinkChange(
  source: { id: string; linkedTableIds: string[] },
  target: { id: string; linkedTableIds: string[] },
  maximumLinks: number
): TableLinkChange {
  if (source.id === target.id) {
    return { ok: false, reason: 'same-table' };
  }

  const currentlyLinked = source.linkedTableIds.includes(target.id);
  if (!currentlyLinked && source.linkedTableIds.length >= maximumLinks) {
    return { ok: false, reason: 'source-full' };
  }
  if (!currentlyLinked && target.linkedTableIds.length >= maximumLinks) {
    return { ok: false, reason: 'target-full' };
  }

  return {
    ok: true,
    action: currentlyLinked ? 'unlink' : 'link',
    sourceLinks: uniqueSortedIds(
      currentlyLinked
        ? source.linkedTableIds.filter((id) => id !== target.id)
        : [...source.linkedTableIds, target.id]
    ),
    targetLinks: uniqueSortedIds(
      currentlyLinked
        ? target.linkedTableIds.filter((id) => id !== source.id)
        : [...target.linkedTableIds, source.id]
    ),
  };
}

function uniqueSortedIds(ids: string[]): string[] {
  return [...new Set(ids)].sort((left, right) => left.localeCompare(right));
}
