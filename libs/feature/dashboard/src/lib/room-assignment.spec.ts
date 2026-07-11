import {
  formatTableRoomLabel,
  normalizeRoomNumbers,
  primaryRoomNumber,
} from './room-assignment';

describe('room assignment helpers', () => {
  it('falls back to the legacy single room number', () => {
    expect(normalizeRoomNumbers(undefined, 203)).toEqual([203]);
  });

  it('deduplicates and sorts room numbers', () => {
    expect(normalizeRoomNumbers([305, 101, 305, 203], null)).toEqual([
      101, 203, 305,
    ]);
  });

  it('returns the first linked room as the primary room number', () => {
    expect(primaryRoomNumber([101, 203])).toBe(101);
    expect(primaryRoomNumber([])).toBeNull();
  });

  it('formats the table room label for one or more rooms', () => {
    expect(formatTableRoomLabel([101])).toBe('Room 101');
    expect(formatTableRoomLabel([101, 203])).toBe('Room 101, 203');
    expect(formatTableRoomLabel([])).toBe('');
  });
});
