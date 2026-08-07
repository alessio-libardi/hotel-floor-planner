import { TestBed } from '@angular/core/testing';
import { of, throwError } from 'rxjs';
import type { PlanItemDto } from './floor-planner.api';
import { PlanLayoutStore } from './plan-layout.store';

vi.mock('./floor-planner.api', () => ({
  FloorPlannerApi: class FloorPlannerApi {},
}));

const { FloorPlannerApi } = await import('./floor-planner.api');

describe('PlanLayoutStore table chains', () => {
  let api: {
    getPlanItems: ReturnType<typeof vi.fn>;
    applyPlanItemChanges: ReturnType<typeof vi.fn>;
  };
  let store: PlanLayoutStore;

  beforeEach(async () => {
    api = {
      getPlanItems: vi.fn(() => of([tableDto('1'), tableDto('2')])),
      applyPlanItemChanges: vi.fn(() => of(undefined)),
    };

    TestBed.configureTestingModule({
      providers: [PlanLayoutStore, { provide: FloorPlannerApi, useValue: api }],
    });
    store = TestBed.inject(PlanLayoutStore);
    await vi.waitFor(() => expect(store.items).toHaveLength(2));
  });

  afterEach(() => TestBed.resetTestingModule());

  it('optimistically applies and persists a target-owned link', async () => {
    await store.toggleTableLink('1', '2');

    expect(
      store.items.map((item) => [
        item.id,
        item.displayTableNumber,
        item.isTableNumberAnchor,
      ])
    ).toEqual([
      ['1', '2', false],
      ['2', '2', true],
    ]);
    expect(api.applyPlanItemChanges).toHaveBeenCalledOnce();
  });

  it('rolls the complete chain state back when the batch fails', async () => {
    const before = store.items;
    const consoleError = vi
      .spyOn(console, 'error')
      .mockImplementation(() => undefined);
    api.applyPlanItemChanges.mockReturnValue(
      throwError(() => new Error('write failed'))
    );

    try {
      await expect(store.toggleTableLink('1', '2')).rejects.toThrow(
        'write failed'
      );
      expect(store.items).toEqual(before);
    } finally {
      consoleError.mockRestore();
    }
  });

  it('deletes a middle table and splits both sides in one batch', async () => {
    api.getPlanItems.mockReturnValue(
      of([
        tableDto('1', ['2'], true),
        tableDto('2', ['1', '3'], false),
        tableDto('3', ['2'], false),
      ])
    );
    await store.refresh();

    await store.deleteItem('2');

    expect(store.items).toMatchObject([
      {
        id: '1',
        linkedTableIds: [],
        isTableNumberAnchor: true,
        displayTableNumber: '1',
      },
      {
        id: '3',
        linkedTableIds: [],
        isTableNumberAnchor: true,
        displayTableNumber: '3',
      },
    ]);
    expect(api.applyPlanItemChanges).toHaveBeenLastCalledWith(
      [
        {
          id: '1',
          patch: { linkedTableIds: [], isTableNumberAnchor: true },
        },
        {
          id: '3',
          patch: { linkedTableIds: [], isTableNumberAnchor: true },
        },
      ],
      ['2']
    );
  });

  it('rolls a middle deletion back when its batch fails', async () => {
    api.getPlanItems.mockReturnValue(
      of([
        tableDto('1', ['2'], true),
        tableDto('2', ['1', '3'], false),
        tableDto('3', ['2'], false),
      ])
    );
    await store.refresh();
    const before = store.items;
    const consoleError = vi
      .spyOn(console, 'error')
      .mockImplementation(() => undefined);
    api.applyPlanItemChanges.mockReturnValue(
      throwError(() => new Error('write failed'))
    );

    try {
      await expect(store.deleteItem('2')).rejects.toThrow('write failed');
      expect(store.items).toEqual(before);
    } finally {
      consoleError.mockRestore();
    }
  });

  it('promotes the neighbor when deleting an anchor endpoint', async () => {
    api.getPlanItems.mockReturnValue(
      of([tableDto('1', ['2'], false), tableDto('2', ['1'], true)])
    );
    await store.refresh();

    await store.deleteItem('2');

    expect(store.items).toMatchObject([
      {
        id: '1',
        tableNumber: '1',
        displayTableNumber: '1',
        linkedTableIds: [],
        isTableNumberAnchor: true,
      },
    ]);
    expect(api.applyPlanItemChanges).toHaveBeenLastCalledWith(
      [
        {
          id: '1',
          patch: {
            linkedTableIds: [],
            isTableNumberAnchor: true,
          },
        },
      ],
      ['2']
    );
  });
});

function tableDto(
  id: string,
  linkedTableIds: string[] = [],
  isTableNumberAnchor = true
): PlanItemDto {
  return {
    id,
    type: 'table',
    x: 0,
    y: 0,
    width: 74,
    height: 74,
    text: '',
    tableNumber: id,
    roomNumber: null,
    roomNumbers: [],
    linkedTableIds,
    isTableNumberAnchor,
  };
}
