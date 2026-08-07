export interface TableChainItem {
  id: string;
  type: 'table' | 'column' | 'label';
  tableNumber: string | null;
  linkedTableIds: string[];
  isTableNumberAnchor: boolean;
}

export interface TableChainPatch {
  id: string;
  patch: {
    linkedTableIds?: string[];
    isTableNumberAnchor?: boolean;
  };
}

export type TableChainRuleFailure =
  | 'table-not-found'
  | 'source-middle'
  | 'target-middle'
  | 'same-group';

export type TableChainChange =
  | {
      ok: true;
      action: 'link' | 'unlink';
      patches: TableChainPatch[];
    }
  | {
      ok: false;
      reason: TableChainRuleFailure;
    };

export function tableChainChange(
  items: TableChainItem[],
  sourceTableId: string,
  targetTableId: string
): TableChainChange {
  const tables = items.filter((item) => item.type === 'table');
  const tablesById = new Map(tables.map((table) => [table.id, table]));
  const source = tablesById.get(sourceTableId);
  const target = tablesById.get(targetTableId);

  if (!source || !target || source.id === target.id) {
    return { ok: false, reason: 'table-not-found' };
  }

  if (areDirectlyLinked(source, target)) {
    return unlinkEdge(tables, source, target);
  }

  if (source.linkedTableIds.length >= 2) {
    return { ok: false, reason: 'source-middle' };
  }
  if (target.linkedTableIds.length >= 2) {
    return { ok: false, reason: 'target-middle' };
  }

  const sourceComponent = tableComponent(tables, source.id);
  if (sourceComponent.some((table) => table.id === target.id)) {
    return { ok: false, reason: 'same-group' };
  }

  const targetComponent = tableComponent(tables, target.id);
  const winningComponent =
    sourceComponent.length > targetComponent.length
      ? sourceComponent
      : targetComponent;
  const winningAnchor = tableNumberAnchor(winningComponent);
  const patches = new Map<string, TableChainPatch['patch']>();

  mergePatch(patches, source.id, {
    linkedTableIds: uniqueSortedIds([...source.linkedTableIds, target.id]),
  });
  mergePatch(patches, target.id, {
    linkedTableIds: uniqueSortedIds([...target.linkedTableIds, source.id]),
  });

  for (const table of [...sourceComponent, ...targetComponent]) {
    mergePatch(patches, table.id, {
      isTableNumberAnchor: table.id === winningAnchor.id,
    });
  }

  return { ok: true, action: 'link', patches: toPatchArray(patches) };
}

export function tableChainDeletionPatches(
  items: TableChainItem[],
  tableId: string
): TableChainPatch[] {
  const tables = items.filter((item) => item.type === 'table');
  const deleted = tables.find((table) => table.id === tableId);
  if (!deleted) {
    return [];
  }

  const previousComponent = tableComponent(tables, deleted.id);
  const previousAnchor = tableNumberAnchor(previousComponent);
  const boundaryIds = new Set(
    previousComponent
      .filter(
        (table) =>
          table.id !== deleted.id &&
          (deleted.linkedTableIds.includes(table.id) ||
            table.linkedTableIds.includes(deleted.id))
      )
      .map((table) => table.id)
  );
  const remainingTables = tables
    .filter((table) => table.id !== deleted.id)
    .map((table) => ({
      ...table,
      linkedTableIds: table.linkedTableIds.filter((id) => id !== deleted.id),
    }));
  const boundaryTables = remainingTables
    .filter((table) => boundaryIds.has(table.id))
    .sort((left, right) => left.id.localeCompare(right.id));
  const patches = new Map<string, TableChainPatch['patch']>();
  const visited = new Set<string>();

  for (const boundary of boundaryTables) {
    mergePatch(patches, boundary.id, {
      linkedTableIds: boundary.linkedTableIds,
    });

    if (visited.has(boundary.id)) {
      continue;
    }

    const fragment = tableComponent(remainingTables, boundary.id);
    const fragmentAnchor = fragment.some(
      (table) => table.id === previousAnchor.id
    )
      ? previousAnchor
      : boundary;

    for (const table of fragment) {
      visited.add(table.id);
      mergePatch(patches, table.id, {
        isTableNumberAnchor: table.id === fragmentAnchor.id,
      });
    }
  }

  return toPatchArray(patches);
}

export function tableNumberDisplayMap(
  items: TableChainItem[]
): Map<string, string | null> {
  const tables = items.filter((item) => item.type === 'table');
  const visited = new Set<string>();
  const displayNumbers = new Map<string, string | null>();

  for (const table of tables) {
    if (visited.has(table.id)) {
      continue;
    }

    const component = tableComponent(tables, table.id);
    const anchor = tableNumberAnchor(component);
    for (const member of component) {
      visited.add(member.id);
      displayNumbers.set(member.id, anchor.tableNumber);
    }
  }

  return displayNumbers;
}

export function tableNumberAnchorBackfill(
  items: TableChainItem[]
): TableChainPatch[] {
  const tables = items.filter((item) => item.type === 'table');
  const visited = new Set<string>();
  const patches = new Map<string, TableChainPatch['patch']>();

  for (const table of tables) {
    if (visited.has(table.id)) {
      continue;
    }

    const component = tableComponent(tables, table.id);
    const explicitAnchors = component.filter(
      (member) => member.isTableNumberAnchor
    );
    const anchor = tableNumberAnchor(component);

    for (const member of component) {
      visited.add(member.id);
    }

    if (explicitAnchors.length === 1) {
      continue;
    }

    for (const member of component) {
      mergePatch(patches, member.id, {
        isTableNumberAnchor: member.id === anchor.id,
      });
    }
  }

  return toPatchArray(patches);
}

export function tableComponent(
  items: TableChainItem[],
  tableId: string
): TableChainItem[] {
  const tables = items.filter((item) => item.type === 'table');
  const tablesById = new Map(tables.map((table) => [table.id, table]));
  const visited = new Set<string>();
  const pending = [tableId];
  const component: TableChainItem[] = [];

  while (pending.length > 0) {
    const currentId = pending.pop();
    if (!currentId || visited.has(currentId)) {
      continue;
    }

    const current = tablesById.get(currentId);
    if (!current) {
      continue;
    }

    visited.add(current.id);
    component.push(current);

    for (const linkedId of current.linkedTableIds) {
      if (!visited.has(linkedId)) {
        pending.push(linkedId);
      }
    }

    for (const candidate of tables) {
      if (
        candidate.linkedTableIds.includes(current.id) &&
        !visited.has(candidate.id)
      ) {
        pending.push(candidate.id);
      }
    }
  }

  return component;
}

function unlinkEdge(
  tables: TableChainItem[],
  source: TableChainItem,
  target: TableChainItem
): TableChainChange {
  const component = tableComponent(tables, source.id);
  const previousAnchor = tableNumberAnchor(component);
  const separatedTables = component.map((table) => {
    if (table.id === source.id) {
      return {
        ...table,
        linkedTableIds: table.linkedTableIds.filter((id) => id !== target.id),
      };
    }
    if (table.id === target.id) {
      return {
        ...table,
        linkedTableIds: table.linkedTableIds.filter((id) => id !== source.id),
      };
    }
    return table;
  });
  const sourceFragment = tableComponent(separatedTables, source.id);
  const targetFragment = tableComponent(separatedTables, target.id);
  const sourceAnchor = sourceFragment.some(
    (table) => table.id === previousAnchor.id
  )
    ? previousAnchor
    : source;
  const targetAnchor = targetFragment.some(
    (table) => table.id === previousAnchor.id
  )
    ? previousAnchor
    : target;
  const patches = new Map<string, TableChainPatch['patch']>();

  mergePatch(patches, source.id, {
    linkedTableIds: source.linkedTableIds.filter((id) => id !== target.id),
  });
  mergePatch(patches, target.id, {
    linkedTableIds: target.linkedTableIds.filter((id) => id !== source.id),
  });

  for (const table of sourceFragment) {
    mergePatch(patches, table.id, {
      isTableNumberAnchor: table.id === sourceAnchor.id,
    });
  }
  for (const table of targetFragment) {
    mergePatch(patches, table.id, {
      isTableNumberAnchor: table.id === targetAnchor.id,
    });
  }

  return { ok: true, action: 'unlink', patches: toPatchArray(patches) };
}

function tableNumberAnchor(component: TableChainItem[]): TableChainItem {
  const anchors = component.filter((table) => table.isTableNumberAnchor);
  if (anchors.length === 1) {
    return anchors[0];
  }

  return [...component].sort((left, right) =>
    left.id.localeCompare(right.id)
  )[0];
}

function areDirectlyLinked(
  source: TableChainItem,
  target: TableChainItem
): boolean {
  return (
    source.linkedTableIds.includes(target.id) ||
    target.linkedTableIds.includes(source.id)
  );
}

function uniqueSortedIds(ids: string[]): string[] {
  return [...new Set(ids)].sort((left, right) => left.localeCompare(right));
}

function mergePatch(
  patches: Map<string, TableChainPatch['patch']>,
  id: string,
  patch: TableChainPatch['patch']
): void {
  patches.set(id, { ...patches.get(id), ...patch });
}

function toPatchArray(
  patches: Map<string, TableChainPatch['patch']>
): TableChainPatch[] {
  return [...patches.entries()]
    .sort(([left], [right]) => left.localeCompare(right))
    .map(([id, patch]) => ({ id, patch }));
}
