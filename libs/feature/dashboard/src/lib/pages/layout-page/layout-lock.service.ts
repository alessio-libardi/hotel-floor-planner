import { DestroyRef, Injectable, inject, signal } from '@angular/core';

export const LAYOUT_LOCK_STORAGE_KEY = 'seatwise.layout.locked.v1';

export interface LayoutLockStorage {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
}

export function readLayoutLock(storage: LayoutLockStorage | null): boolean {
  try {
    return storage?.getItem(LAYOUT_LOCK_STORAGE_KEY) === 'true';
  } catch {
    return false;
  }
}

export function writeLayoutLock(
  storage: LayoutLockStorage | null,
  locked: boolean
): void {
  try {
    storage?.setItem(LAYOUT_LOCK_STORAGE_KEY, String(locked));
  } catch {
    // The signal remains the in-memory fallback when storage is unavailable.
  }
}

@Injectable({ providedIn: 'root' })
export class LayoutLockService {
  private readonly destroyRef = inject(DestroyRef);
  private readonly storage = this.getBrowserStorage();
  private readonly lockedState = signal(readLayoutLock(this.storage));
  private readonly browserWindow =
    typeof window === 'undefined' ? null : window;

  readonly locked = this.lockedState.asReadonly();

  constructor() {
    const onStorage = (event: StorageEvent): void => {
      if (event.key !== LAYOUT_LOCK_STORAGE_KEY) {
        return;
      }

      this.lockedState.set(event.newValue === 'true');
    };

    this.browserWindow?.addEventListener('storage', onStorage);
    this.destroyRef.onDestroy(() => {
      this.browserWindow?.removeEventListener('storage', onStorage);
    });
  }

  setLocked(locked: boolean): void {
    this.lockedState.set(locked);
    writeLayoutLock(this.storage, locked);
  }

  private getBrowserStorage(): LayoutLockStorage | null {
    try {
      return typeof localStorage === 'undefined' ? null : localStorage;
    } catch {
      return null;
    }
  }
}
