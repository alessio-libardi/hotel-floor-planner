import {
  compareTableNumbers,
  nextGeneratedTableNumber,
  normalizeTableNumber,
} from './table-number';

describe('table-number helpers', () => {
  it('normalizes numeric and text identifiers to strings', () => {
    expect(normalizeTableNumber(7)).toBe('7');
    expect(normalizeTableNumber(' 7/2 ')).toBe('7/2');
    expect(normalizeTableNumber('   ')).toBeNull();
  });

  it('sorts identifiers with numeric-aware comparison', () => {
    expect(['10', '2', '7/2'].sort(compareTableNumbers)).toEqual([
      '2',
      '7/2',
      '10',
    ]);
  });

  it('generates the next numeric identifier from numeric-only values', () => {
    expect(nextGeneratedTableNumber(['1', '7/2', '3'])).toBe('4');
  });
});
