import { getRoomDepartureStatus } from './room-departure-status';

describe('getRoomDepartureStatus', () => {
  const now = new Date(2026, 6, 7, 14, 30, 0, 0);

  it('returns none when there is no departure date', () => {
    expect(getRoomDepartureStatus(null, now)).toBe('none');
  });

  it('returns expired for today', () => {
    expect(getRoomDepartureStatus('2026-07-07', now)).toBe('expired');
  });

  it('returns expired for past dates', () => {
    expect(getRoomDepartureStatus('2026-07-06', now)).toBe('expired');
  });

  it('returns tomorrow for tomorrow', () => {
    expect(getRoomDepartureStatus('2026-07-08', now)).toBe('tomorrow');
  });

  it('returns none for dates after tomorrow', () => {
    expect(getRoomDepartureStatus('2026-07-09', now)).toBe('none');
  });
});
