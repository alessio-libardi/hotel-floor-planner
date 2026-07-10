export function normalizeTableNumber(value: unknown): string | null {
  if (value == null) {
    return null;
  }

  const normalized = `${value}`.trim();
  return normalized ? normalized : null;
}

export function compareTableNumbers(
  left: string | null,
  right: string | null
): number {
  if (left == null && right == null) {
    return 0;
  }

  if (left == null) {
    return 1;
  }

  if (right == null) {
    return -1;
  }

  return left.localeCompare(right, undefined, {
    numeric: true,
    sensitivity: 'base',
  });
}

export function nextGeneratedTableNumber(
  tableNumbers: Array<string | null | undefined>
): string {
  const maxNumericTableNumber = tableNumbers.reduce((max, tableNumber) => {
    const parsed = parseGeneratedTableNumber(tableNumber);
    return parsed == null ? max : Math.max(max, parsed);
  }, 0);

  return `${maxNumericTableNumber + 1}`;
}

function parseGeneratedTableNumber(
  value: string | null | undefined
): number | null {
  const normalized = normalizeTableNumber(value);

  if (!normalized || !/^[1-9]\d*$/.test(normalized)) {
    return null;
  }

  return Number(normalized);
}
