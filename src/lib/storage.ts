/**
 * Defensive JSON reads from Web Storage. Corrupt data, wrong shapes, and
 * storage access errors all fall back instead of blanking the page.
 */
export interface JsonStorage {
  getItem: (key: string) => string | null;
  setItem: (key: string, value: string) => void;
}

export function readJson<T>(
  storage: JsonStorage | null | undefined,
  key: string,
  fallback: T,
  isValid?: (value: unknown) => boolean,
): T {
  if (!storage) return fallback;
  let raw: string | null;
  try {
    raw = storage.getItem(key);
  } catch {
    return fallback;
  }
  if (raw === null || raw === undefined) return fallback;
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return fallback;
  }
  if (isValid && !isValid(parsed)) return fallback;
  return parsed as T;
}

export const isArray = (v: unknown): v is unknown[] => Array.isArray(v);
export const isPlainObject = (v: unknown): v is Record<string, unknown> =>
  typeof v === 'object' && v !== null && !Array.isArray(v);
export const isStringRecord = (v: unknown): v is Record<string, string> =>
  isPlainObject(v) && Object.values(v).every((x) => typeof x === 'string');
export const isNumberArray = (v: unknown): v is number[] =>
  Array.isArray(v) && v.every((x) => typeof x === 'number');
