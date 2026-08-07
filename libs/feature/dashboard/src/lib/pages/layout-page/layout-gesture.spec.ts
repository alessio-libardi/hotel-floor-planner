import {
  distanceBetween,
  LayoutGestureMachine,
  midpoint,
} from './layout-gesture';

describe('LayoutGestureMachine', () => {
  it('turns a blank-canvas movement into a pan', () => {
    const gesture = new LayoutGestureMachine();

    expect(gesture.begin(1, { x: 10, y: 10 }, { kind: 'canvas' })).toBe('idle');
    expect(gesture.move(1, { x: 21, y: 10 })).toBe('pan');
    expect(gesture.end(1, { x: 21, y: 10 })?.state).toBe('pan');
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

  it('calculates gesture geometry', () => {
    expect(distanceBetween({ x: 0, y: 0 }, { x: 3, y: 4 })).toBe(5);
    expect(midpoint({ x: 10, y: 20 }, { x: 30, y: 50 })).toEqual({
      x: 20,
      y: 35,
    });
  });
});
