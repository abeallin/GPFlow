import { describe, it, expect } from 'vitest';
import { readJson } from '@/lib/storage';

function fakeStorage(initial: Record<string, string> = {}) {
  const store = { ...initial };
  return {
    getItem: (k: string) => (k in store ? store[k] : null),
    setItem: (k: string, v: string) => { store[k] = v; },
    removeItem: (k: string) => { delete store[k]; },
  };
}

describe('readJson', () => {
  it('returns the fallback when the key is missing', () => {
    expect(readJson(fakeStorage(), 'k', [])).toEqual([]);
  });

  it('returns the fallback on corrupt JSON instead of throwing', () => {
    const storage = fakeStorage({ k: '{not json' });
    expect(() => readJson(storage, 'k', { a: 1 })).not.toThrow();
    expect(readJson(storage, 'k', { a: 1 })).toEqual({ a: 1 });
  });

  it('returns the fallback when the value has the wrong shape', () => {
    const storage = fakeStorage({ k: '{"a":1}' });
    expect(readJson(storage, 'k', [] as number[], Array.isArray)).toEqual([]);
  });

  it('returns the parsed value when valid', () => {
    const storage = fakeStorage({ k: '[1,2,3]' });
    expect(readJson(storage, 'k', [] as number[], Array.isArray)).toEqual([1, 2, 3]);
  });

  it('returns the fallback when storage itself throws', () => {
    const storage = {
      getItem: () => { throw new Error('SecurityError'); },
      setItem: () => {},
    };
    expect(readJson(storage, 'k', 'fallback')).toBe('fallback');
  });

  it('returns the fallback for a null storage (SSR)', () => {
    expect(readJson(null, 'k', 7)).toBe(7);
  });
});
