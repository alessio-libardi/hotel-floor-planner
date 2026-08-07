import {
  TableChainItem,
  TableChainPatch,
  tableChainChange,
  tableChainDeletionPatches,
  tableNumberAnchorBackfill,
  tableNumberDisplayMap,
} from './table-link-chain';

describe('table link chains', () => {
  it('makes the target number win when standalone tables merge', () => {
    let tables = [table('1', '1'), table('2', '2')];
    tables = applySuccessfulChange(tables, tableChainChange(tables, '1', '2'));

    expect(displayNumbers(tables)).toEqual({ '1': '2', '2': '2' });
    expect(anchorIds(tables)).toEqual(['2']);
  });

  it('keeps the established group number when a standalone table joins', () => {
    let tables = [table('1', '1'), table('2', '2')];
    tables = applySuccessfulChange(tables, tableChainChange(tables, '1', '2'));

    tables.push(table('3', '3'));
    tables = applySuccessfulChange(tables, tableChainChange(tables, '3', '1'));

    expect(displayNumbers(tables)).toEqual({
      '1': '2',
      '2': '2',
      '3': '2',
    });
    expect(anchorIds(tables)).toEqual(['2']);

    tables.push(table('4', '4'));
    tables = applySuccessfulChange(tables, tableChainChange(tables, '2', '4'));
    expect(displayNumbers(tables)).toEqual({
      '1': '2',
      '2': '2',
      '3': '2',
      '4': '2',
    });
    expect(anchorIds(tables)).toEqual(['2']);
  });

  it('uses the larger group number and breaks equal-size ties by target', () => {
    const largerSource = [
      table('1', '1', ['2'], true),
      table('2', '2', ['1'], false),
      table('3', '3'),
    ];
    const largerResult = applySuccessfulChange(
      largerSource,
      tableChainChange(largerSource, '2', '3')
    );
    expect(anchorIds(largerResult)).toEqual(['1']);
    expect(displayNumbers(largerResult)).toEqual({
      '1': '1',
      '2': '1',
      '3': '1',
    });

    const equalGroups = [
      table('1', '1', ['2'], true),
      table('2', '2', ['1'], false),
      table('3', '3', ['4'], true),
      table('4', '4', ['3'], false),
    ];
    const equalResult = applySuccessfulChange(
      equalGroups,
      tableChainChange(equalGroups, '2', '3')
    );
    expect(anchorIds(equalResult)).toEqual(['3']);
    expect(displayNumbers(equalResult)).toEqual({
      '1': '3',
      '2': '3',
      '3': '3',
      '4': '3',
    });
  });

  it('peels a non-anchor endpoint and restores its own number', () => {
    const tables = chainThreeTables();
    const next = applySuccessfulChange(
      tables,
      tableChainChange(tables, '3', '1')
    );

    expect(displayNumbers(next)).toEqual({
      '1': '2',
      '2': '2',
      '3': '3',
    });
    expect(anchorIds(next)).toEqual(['2', '3']);
  });

  it('promotes the neighbor when the anchor endpoint is peeled', () => {
    const tables = chainThreeTables();
    const next = applySuccessfulChange(
      tables,
      tableChainChange(tables, '2', '1')
    );

    expect(displayNumbers(next)).toEqual({
      '1': '1',
      '2': '2',
      '3': '1',
    });
    expect(anchorIds(next)).toEqual(['1', '2']);
  });

  it('allows a selected middle edge to unlink', () => {
    const tables = chainThreeTables();
    const next = applySuccessfulChange(
      tables,
      tableChainChange(tables, '1', '2')
    );

    expect(displayNumbers(next)).toEqual({
      '1': '1',
      '2': '2',
      '3': '1',
    });
    expect(anchorIds(next)).toEqual(['1', '2']);
  });

  it('rejects new middle links and cycles', () => {
    const tables = chainThreeTables();

    expect(tableChainChange(tables, '1', '4')).toEqual({
      ok: false,
      reason: 'table-not-found',
    });
    expect(tableChainChange([...tables, table('4', '4')], '1', '4')).toEqual({
      ok: false,
      reason: 'source-middle',
    });
    expect(tableChainChange([...tables, table('4', '4')], '4', '1')).toEqual({
      ok: false,
      reason: 'target-middle',
    });
    expect(tableChainChange(tables, '3', '2')).toEqual({
      ok: false,
      reason: 'same-group',
    });
  });

  it('splits around a deleted non-anchor middle table', () => {
    const tables = [
      table('1', '1', ['2'], true),
      table('2', '2', ['1', '3'], false),
      table('3', '3', ['2'], false),
    ];
    const next = applyPatches(
      tables.filter((entry) => entry.id !== '2'),
      tableChainDeletionPatches(tables, '2')
    );

    expect(next.map((entry) => [entry.id, entry.linkedTableIds])).toEqual([
      ['1', []],
      ['3', []],
    ]);
    expect(anchorIds(next)).toEqual(['1', '3']);
    expect(displayNumbers(next)).toEqual({ '1': '1', '3': '3' });
  });

  it('gives both boundary tables ownership when the middle anchor is deleted', () => {
    const tables = [
      table('1', '1', ['2'], false),
      table('2', '2', ['1', '3'], true),
      table('3', '3', ['2'], false),
    ];
    const next = applyPatches(
      tables.filter((entry) => entry.id !== '2'),
      tableChainDeletionPatches(tables, '2')
    );

    expect(anchorIds(next)).toEqual(['1', '3']);
    expect(displayNumbers(next)).toEqual({ '1': '1', '3': '3' });
  });

  it('uses the anchor own number and exposes non-anchor edits after detach', () => {
    let tables = chainThreeTables().map((entry) =>
      entry.id === '3' ? { ...entry, tableNumber: '30' } : entry
    );
    expect(displayNumbers(tables)['3']).toBe('2');

    tables = applySuccessfulChange(tables, tableChainChange(tables, '3', '1'));
    expect(displayNumbers(tables)['3']).toBe('30');

    const anchorEdited = tables.map((entry) =>
      entry.id === '2' ? { ...entry, tableNumber: '20' } : entry
    );
    expect(displayNumbers(anchorEdited)['1']).toBe('20');
  });

  it('backfills one deterministic anchor per legacy component', () => {
    const legacy = [
      table('b', '2', ['a'], false),
      table('a', '2', ['b'], false),
      table('c', '3', [], false),
    ];
    const patches = tableNumberAnchorBackfill(legacy);
    const migrated = applyPatches(legacy, patches);

    expect(anchorIds(migrated)).toEqual(['a', 'c']);
    expect(displayNumbers(migrated)).toEqual({ a: '2', b: '2', c: '3' });
    expect(tableNumberAnchorBackfill(migrated)).toEqual([]);
  });
});

function chainThreeTables(): TableChainItem[] {
  return [
    table('1', '1', ['2', '3'], false),
    table('2', '2', ['1'], true),
    table('3', '3', ['1'], false),
  ];
}

function table(
  id: string,
  tableNumber: string,
  linkedTableIds: string[] = [],
  isTableNumberAnchor = true
): TableChainItem {
  return {
    id,
    type: 'table',
    tableNumber,
    linkedTableIds,
    isTableNumberAnchor,
  };
}

function applySuccessfulChange(
  tables: TableChainItem[],
  change: ReturnType<typeof tableChainChange>
): TableChainItem[] {
  if (!change.ok) {
    throw new Error(`Expected a valid change, received ${change.reason}`);
  }
  return applyPatches(tables, change.patches);
}

function applyPatches(
  tables: TableChainItem[],
  patches: TableChainPatch[]
): TableChainItem[] {
  const patchesById = new Map(patches.map((entry) => [entry.id, entry.patch]));
  return tables.map((entry) => ({
    ...entry,
    ...patchesById.get(entry.id),
  }));
}

function displayNumbers(
  tables: TableChainItem[]
): Record<string, string | null> {
  return Object.fromEntries(tableNumberDisplayMap(tables));
}

function anchorIds(tables: TableChainItem[]): string[] {
  return tables
    .filter((entry) => entry.isTableNumberAnchor)
    .map((entry) => entry.id)
    .sort();
}
