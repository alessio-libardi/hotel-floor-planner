export function normalizeRoomNumbers(
  roomNumbers: number[] | null | undefined,
  roomNumber: number | null | undefined = null
): number[] {
  const merged = roomNumbers ?? (roomNumber != null ? [roomNumber] : []);

  return [...new Set(merged)]
    .filter((entry) => Number.isFinite(entry))
    .sort((left, right) => left - right);
}

export function primaryRoomNumber(roomNumbers: number[]): number | null {
  return roomNumbers[0] ?? null;
}

export function formatTableRoomLabel(roomNumbers: number[]): string {
  return roomNumbers.length > 0 ? `Room ${roomNumbers.join(', ')}` : '';
}
