export const GESTURE_MOVE_THRESHOLD = 10;

export type LayoutGestureState =
  | 'idle'
  | 'item-move'
  | 'pinch'
  | 'link-arming'
  | 'link-drag';

export interface GesturePoint {
  x: number;
  y: number;
}

export type PinchPoints = readonly [GesturePoint, GesturePoint];

export interface GestureViewport {
  x: number;
  y: number;
  scale: number;
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

export class LayoutGestureMachine {
  private readonly pointers = new Map<number, TrackedPointer>();
  private primaryPointerId: number | null = null;
  private primaryTarget: GestureTarget | null = null;
  private pinchPointerIds: readonly [number, number] | null = null;

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
      if (!this.pinchPointerIds) {
        const [firstPointerId, secondPointerId] = this.pointers.keys();
        this.pinchPointerIds = [firstPointerId, secondPointerId];
      }
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

    if (this.primaryTarget?.kind === 'item') {
      this.state = 'item-move';
    }
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

  pinchPoints(): PinchPoints | null {
    if (!this.pinchPointerIds) {
      return null;
    }

    const first = this.pointers.get(this.pinchPointerIds[0]);
    const second = this.pointers.get(this.pinchPointerIds[1]);
    return first && second ? [first.current, second.current] : null;
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
    this.pinchPointerIds = null;
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

export function viewportForPinch(
  initialViewport: GestureViewport,
  initialPoints: PinchPoints,
  currentPoints: PinchPoints,
  minScale: number,
  maxScale: number
): GestureViewport {
  const initialCenter = midpoint(initialPoints[0], initialPoints[1]);
  const currentCenter = midpoint(currentPoints[0], currentPoints[1]);
  const initialDistance = distanceBetween(initialPoints[0], initialPoints[1]);

  if (initialDistance <= 0 || initialViewport.scale <= 0) {
    return initialViewport;
  }

  const currentDistance = distanceBetween(currentPoints[0], currentPoints[1]);
  const scale = clamp(
    initialViewport.scale * (currentDistance / initialDistance),
    minScale,
    maxScale
  );
  const worldX = (initialCenter.x - initialViewport.x) / initialViewport.scale;
  const worldY = (initialCenter.y - initialViewport.y) / initialViewport.scale;

  return {
    x: currentCenter.x - worldX * scale,
    y: currentCenter.y - worldY * scale,
    scale,
  };
}

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}
