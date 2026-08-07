import { TestBed } from '@angular/core/testing';
import {
  LAYOUT_LOCK_STORAGE_KEY,
  LayoutLockService,
  LayoutLockStorage,
  readLayoutLock,
  writeLayoutLock,
} from './layout-lock.service';

describe('LayoutLockService', () => {
  beforeEach(() => {
    localStorage.removeItem(LAYOUT_LOCK_STORAGE_KEY);
    TestBed.configureTestingModule({});
  });

  afterEach(() => {
    TestBed.resetTestingModule();
    localStorage.removeItem(LAYOUT_LOCK_STORAGE_KEY);
  });

  it('starts editable and persists changes for the device', () => {
    const service = TestBed.inject(LayoutLockService);

    expect(service.locked()).toBe(false);

    service.setLocked(true);
    expect(service.locked()).toBe(true);
    expect(localStorage.getItem(LAYOUT_LOCK_STORAGE_KEY)).toBe('true');
  });

  it('restores the saved state and follows storage events from other tabs', () => {
    localStorage.setItem(LAYOUT_LOCK_STORAGE_KEY, 'true');
    const service = TestBed.inject(LayoutLockService);

    expect(service.locked()).toBe(true);

    window.dispatchEvent(
      new StorageEvent('storage', {
        key: LAYOUT_LOCK_STORAGE_KEY,
        newValue: 'false',
      })
    );
    expect(service.locked()).toBe(false);
  });
});

describe('layout lock persistence', () => {
  it('defaults to editable when no preference is saved', () => {
    const storage = createStorage();

    expect(readLayoutLock(storage)).toBe(false);
    expect(readLayoutLock(null)).toBe(false);
  });

  it('restores a saved device lock state', () => {
    const storage = createStorage();
    storage.setItem(LAYOUT_LOCK_STORAGE_KEY, 'true');

    expect(readLayoutLock(storage)).toBe(true);

    storage.setItem(LAYOUT_LOCK_STORAGE_KEY, 'false');
    expect(readLayoutLock(storage)).toBe(false);
  });

  it('persists lock and unlock choices', () => {
    const storage = createStorage();

    writeLayoutLock(storage, true);
    expect(storage.getItem(LAYOUT_LOCK_STORAGE_KEY)).toBe('true');

    writeLayoutLock(storage, false);
    expect(storage.getItem(LAYOUT_LOCK_STORAGE_KEY)).toBe('false');
  });

  it('falls back safely when storage access fails', () => {
    const unavailableStorage: LayoutLockStorage = {
      getItem: () => {
        throw new Error('Storage unavailable');
      },
      setItem: () => {
        throw new Error('Storage unavailable');
      },
    };

    expect(readLayoutLock(unavailableStorage)).toBe(false);
    expect(() => writeLayoutLock(unavailableStorage, true)).not.toThrow();
  });
});

function createStorage(): LayoutLockStorage {
  const values = new Map<string, string>();

  return {
    getItem: (key) => values.get(key) ?? null,
    setItem: (key, value) => values.set(key, value),
  };
}
