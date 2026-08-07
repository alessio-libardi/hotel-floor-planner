import {
  distanceBetween,
  LayoutGestureMachine,
  midpoint,
  viewportForPinch,
} from './layout-gesture';

describe('LayoutGestureMachine', () => {
  it('keeps blank-canvas movement idle', () => {
    const gesture = new LayoutGestureMachine();

    expect(gesture.begin(1, { x: 10, y: 10 }, { kind: 'canvas' })).toBe('idle');
    expect(gesture.move(1, { x: 21, y: 10 })).toBe('idle');
    expect(gesture.end(1, { x: 21, y: 10 })?.state).toBe('idle');
    expect(gesture.state).toBe('idle');
  });

  it('turns item movement into a move before a link can activate', () => {
    const gesture = new LayoutGestureMachine();

    gesture.begin(
      1,
      { x: 10, y: 10 },
      { kind: 'item', itemId: 'table-1', canLink: true }
    );

    expect(gesture.state).toBe('link-arming');
    expect(gesture.move(1, { x: 25, y: 10 })).toBe('item-move');
    expect(gesture.activateLink(1)).toBe(false);
  });

  it('keeps a short item gesture as a tap', () => {
    const gesture = new LayoutGestureMachine();

    gesture.begin(1, { x: 10, y: 10 }, { kind: 'item', itemId: 'column-1' });
    expect(gesture.move(1, { x: 17, y: 15 })).toBe('idle');
    expect(gesture.end(1, { x: 17, y: 15 })).toMatchObject({
      state: 'idle',
      target: { kind: 'item', itemId: 'column-1' },
    });
  });

  it('activates linking only while a single pointer remains still', () => {
    const gesture = new LayoutGestureMachine();

    gesture.begin(
      7,
      { x: 20, y: 20 },
      { kind: 'item', itemId: 'table-1', canLink: true }
    );

    expect(gesture.activateLink(7)).toBe(true);
    expect(gesture.state).toBe('link-drag');
    expect(gesture.end(7, { x: 80, y: 80 })?.state).toBe('link-drag');
  });

  it('gives a second pointer priority and stays in pinch until all lift', () => {
    const gesture = new LayoutGestureMachine();

    gesture.begin(
      1,
      { x: 20, y: 20 },
      { kind: 'item', itemId: 'table-1', canLink: true }
    );
    expect(gesture.begin(2, { x: 80, y: 20 }, { kind: 'canvas' })).toBe(
      'pinch'
    );
    expect(gesture.end(2, { x: 80, y: 20 })?.state).toBe('pinch');
    expect(gesture.state).toBe('pinch');
    expect(gesture.end(1, { x: 20, y: 20 })?.state).toBe('pinch');
    expect(gesture.state).toBe('idle');
  });

  it('cancels an uncommitted item move when a second pointer starts', () => {
    const gesture = new LayoutGestureMachine();

    gesture.begin(1, { x: 10, y: 10 }, { kind: 'item', itemId: 'table-1' });
    expect(gesture.move(1, { x: 30, y: 10 })).toBe('item-move');
    expect(gesture.begin(2, { x: 80, y: 10 }, { kind: 'canvas' })).toBe(
      'pinch'
    );
  });

  it('locks the first pinch pair and freezes when either pointer lifts', () => {
    const gesture = new LayoutGestureMachine();

    gesture.begin(1, { x: 10, y: 10 }, { kind: 'canvas' });
    gesture.begin(2, { x: 70, y: 10 }, { kind: 'canvas' });
    gesture.begin(3, { x: 130, y: 10 }, { kind: 'canvas' });
    gesture.move(3, { x: 160, y: 40 });

    expect(gesture.pinchPoints()).toEqual([
      { x: 10, y: 10 },
      { x: 70, y: 10 },
    ]);

    gesture.end(1, { x: 10, y: 10 });
    expect(gesture.pinchPoints()).toBeNull();
    expect(gesture.move(2, { x: 90, y: 20 })).toBe('pinch');
    expect(gesture.state).toBe('pinch');

    gesture.end(2, { x: 90, y: 20 });
    gesture.end(3, { x: 160, y: 40 });
    expect(gesture.state).toBe('idle');
  });

  it('clears the fixed pinch pair on cancellation', () => {
    const gesture = new LayoutGestureMachine();

    gesture.begin(1, { x: 10, y: 10 }, { kind: 'canvas' });
    gesture.begin(2, { x: 70, y: 10 }, { kind: 'canvas' });
    gesture.cancelAll();

    expect(gesture.pointerCount).toBe(0);
    expect(gesture.pinchPoints()).toBeNull();
    expect(gesture.state).toBe('idle');
  });

  it('calculates gesture geometry', () => {
    expect(distanceBetween({ x: 0, y: 0 }, { x: 3, y: 4 })).toBe(5);
    expect(midpoint({ x: 10, y: 20 }, { x: 30, y: 50 })).toEqual({
      x: 20,
      y: 35,
    });
  });

  it('pans with parallel finger movement without changing scale', () => {
    expect(
      viewportForPinch(
        { x: 10, y: 20, scale: 2 },
        [
          { x: 20, y: 20 },
          { x: 80, y: 20 },
        ],
        [
          { x: 35, y: 30 },
          { x: 95, y: 30 },
        ],
        0.5,
        2.6
      )
    ).toEqual({ x: 25, y: 30, scale: 2 });
  });

  it('zooms around a stationary midpoint', () => {
    expect(
      viewportForPinch(
        { x: 0, y: 0, scale: 1 },
        [
          { x: 40, y: 20 },
          { x: 60, y: 20 },
        ],
        [
          { x: 30, y: 20 },
          { x: 70, y: 20 },
        ],
        0.5,
        4
      )
    ).toEqual({ x: -50, y: -20, scale: 2 });
  });

  it('combines diagonal panning and zooming', () => {
    expect(
      viewportForPinch(
        { x: 10, y: 20, scale: 2 },
        [
          { x: 20, y: 20 },
          { x: 80, y: 20 },
        ],
        [
          { x: 30, y: 40 },
          { x: 120, y: 40 },
        ],
        0.5,
        4
      )
    ).toEqual({ x: 15, y: 40, scale: 3 });
  });

  it('clamps pinch scale while keeping the midpoint anchored', () => {
    const initialPoints = [
      { x: 0, y: 0 },
      { x: 100, y: 0 },
    ] as const;

    expect(
      viewportForPinch(
        { x: 0, y: 0, scale: 1 },
        initialPoints,
        [
          { x: -450, y: 0 },
          { x: 550, y: 0 },
        ],
        0.5,
        2
      )
    ).toEqual({ x: -50, y: 0, scale: 2 });
    expect(
      viewportForPinch(
        { x: 0, y: 0, scale: 1 },
        initialPoints,
        [
          { x: 45, y: 0 },
          { x: 55, y: 0 },
        ],
        0.5,
        2
      )
    ).toEqual({ x: 25, y: 0, scale: 0.5 });
  });
});
