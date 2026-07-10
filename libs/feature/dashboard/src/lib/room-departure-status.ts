export type RoomDepartureStatus = 'none' | 'tomorrow' | 'expired';

export const TOMORROW_HIGHLIGHT_BACKGROUND = '#fef3c7';
export const TOMORROW_HIGHLIGHT_FOREGROUND = '#78350f';
export const TOMORROW_HIGHLIGHT_ACCENT = '#b45309';

export function getRoomDepartureStatus(
  departureDate: string | null | undefined,
  now: Date = new Date()
): RoomDepartureStatus {
  if (!departureDate) {
    return 'none';
  }

  const today = normalizeDate(now);
  const tomorrow = new Date(today);
  tomorrow.setDate(tomorrow.getDate() + 1);

  const todayString = formatDateOnly(today);
  const tomorrowString = formatDateOnly(tomorrow);

  if (departureDate === tomorrowString) {
    return 'tomorrow';
  }

  if (departureDate <= todayString) {
    return 'expired';
  }

  return 'none';
}

function normalizeDate(value: Date): Date {
  const normalized = new Date(value);
  normalized.setHours(0, 0, 0, 0);
  return normalized;
}

function formatDateOnly(value: Date): string {
  const year = value.getFullYear();
  const month = `${value.getMonth() + 1}`.padStart(2, '0');
  const day = `${value.getDate()}`.padStart(2, '0');

  return `${year}-${month}-${day}`;
}
