// Storage that never throws: a private window or blocked storage just means nothing is remembered.

export const STORAGE_KEY = 'lens.v1';

export interface CardRecord {
  cardId: string;
  attempts: number;
  misses: number;
  seconds: number;
  clueCorrect: boolean;
  variantSeconds?: number;
}

type Saved = Record<string, CardRecord>;

export const safeStorage = {
  get(): Saved {
    try {
      const raw = window.localStorage.getItem(STORAGE_KEY);
      const parsed: unknown = raw ? JSON.parse(raw) : {};
      return parsed && typeof parsed === 'object' ? (parsed as Saved) : {};
    } catch {
      return {};
    }
  },
  set(value: Saved): void {
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(value));
    } catch {
      // Storage unavailable (private window, quota, disabled): keep going without it.
    }
  },
};

export function saveRecord(record: CardRecord): void {
  safeStorage.set({ ...safeStorage.get(), [record.cardId]: record });
}

export function loadRecord(cardId: string): CardRecord | undefined {
  return safeStorage.get()[cardId];
}
