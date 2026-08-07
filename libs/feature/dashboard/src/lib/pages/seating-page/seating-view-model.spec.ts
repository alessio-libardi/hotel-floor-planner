import { FloorViewModel } from '../../floor.models';
import { PlanItem } from '../../plan-layout.store';
import { createSeatingFloors } from './seating-view-model';

describe('createSeatingFloors', () => {
  const floors: FloorViewModel[] = [
    {
      id: 'floor-1',
      number: 1,
      rooms: [
        {
          id: 'room-100',
          label: 'Room 100',
          number: 100,
          arrivalDate: null,
          departureDate: '2026-08-08',
          checkedDate: '2026-08-07',
          note: 'Window seat',
        },
        {
          id: 'room-101',
          label: 'Room 101',
          number: 101,
          arrivalDate: null,
          departureDate: '2026-08-07',
          checkedDate: null,
          note: null,
        },
        {
          id: 'room-102',
          label: 'Room 102',
          number: 102,
          arrivalDate: null,
          departureDate: null,
          checkedDate: null,
          note: null,
        },
      ],
    },
    { id: 'floor-2', number: 2, rooms: [] },
  ];

  it('resolves room presentation data without mutating its inputs', () => {
    const table = createTable('table-4', '4', [100]);
    const result = createSeatingFloors(floors, [table], '2026-08-07');

    expect(result).toEqual([
      {
        id: 'floor-1',
        number: 1,
        rooms: [
          {
            id: 'room-100',
            number: 100,
            note: 'Window seat',
            checkedToday: true,
            departureStatus: 'tomorrow',
            tableNumber: '4',
          },
          {
            id: 'room-101',
            number: 101,
            note: null,
            checkedToday: false,
            departureStatus: 'expired',
            tableNumber: null,
          },
          {
            id: 'room-102',
            number: 102,
            note: null,
            checkedToday: false,
            departureStatus: 'none',
            tableNumber: null,
          },
        ],
      },
      { id: 'floor-2', number: 2, rooms: [] },
    ]);
    expect(floors[0].rooms[0].note).toBe('Window seat');
  });

  it('uses displayed table numbers and preserves the existing last-match rule', () => {
    const result = createSeatingFloors(
      floors,
      [createTable('first', '1', [100]), createTable('second', '9', [100])],
      '2026-08-07'
    );

    expect(result[0].rooms[0].tableNumber).toBe('9');
  });
});

function createTable(
  id: string,
  displayTableNumber: string,
  roomNumbers: number[]
): PlanItem {
  return {
    id,
    type: 'table',
    x: 0,
    y: 0,
    width: 96,
    height: 72,
    text: '',
    tableNumber: displayTableNumber,
    displayTableNumber,
    roomNumber: roomNumbers[0] ?? null,
    roomNumbers,
    linkedTableIds: [],
    isTableNumberAnchor: true,
  };
}
