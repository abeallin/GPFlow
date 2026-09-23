import { describe, it, expect } from 'vitest';
import {
  practiceKey,
  rebuildAssignments,
  groupSelectedByAccount,
  findCrossAccountDuplicates,
  allocatePracticeIds,
  NEXT_PRACTICE_ID_KEY,
} from '@/lib/assignments';
import type { Account } from '@/lib/accounts';

const accounts: Account[] = [
  { id: 'acc1', label: 'one', username: 'one@nhs.net' },
  { id: 'acc2', label: 'two', username: 'two@nhs.net' },
];

// Same accurx_id (X1) appears in two files.
const practices = [
  { id: 1, name: 'Alpha Surgery', accurx_id: 'X1', source_file: 'a.csv' },
  { id: 2, name: 'Alpha Surgery', accurx_id: 'X1', source_file: 'b.csv' },
  { id: 3, name: 'Beta Surgery', accurx_id: 'X2', source_file: 'b.csv' },
  { id: 4, name: 'Orphan', accurx_id: 'X9', source_file: 'c.csv' },
];

const files = [
  { fileName: 'a.csv', practiceCount: 1, accountId: 'acc1' },
  { fileName: 'b.csv', practiceCount: 2, accountId: 'acc2' },
  { fileName: 'c.csv', practiceCount: 1, accountId: null },
];

describe('practiceKey', () => {
  it('is the composite of source_file and accurx_id', () => {
    expect(practiceKey(practices[0])).toBe('a.csv::X1');
    expect(practiceKey(practices[1])).toBe('b.csv::X1');
    expect(practiceKey(practices[0])).not.toBe(practiceKey(practices[1]));
  });
});

describe('rebuildAssignments', () => {
  it('keeps two distinct assignments for the same accurx_id in two files', () => {
    const assignments = rebuildAssignments(practices, files);
    expect(assignments['a.csv::X1']).toBe('acc1');
    expect(assignments['b.csv::X1']).toBe('acc2');
    expect(assignments['b.csv::X2']).toBe('acc2');
    expect(Object.keys(assignments)).toHaveLength(3);
    // Never keyed by accurx_id alone or by numeric id.
    expect(assignments['X1']).toBeUndefined();
    expect(assignments['1']).toBeUndefined();
  });

  it('does not assign practices whose file has no account', () => {
    const assignments = rebuildAssignments(practices, files);
    expect(assignments['c.csv::X9']).toBeUndefined();
  });
});

describe('groupSelectedByAccount', () => {
  it('produces one group per account with one practice each for the duplicated accurx_id', () => {
    const assignments = rebuildAssignments(practices, files);
    const { groups, unassigned } = groupSelectedByAccount([1, 2, 4], practices, assignments, accounts);

    expect(Object.keys(groups).sort()).toEqual(['acc1', 'acc2']);
    expect(groups.acc1.account.id).toBe('acc1');
    expect(groups.acc1.practices).toEqual([{ id: 1, name: 'Alpha Surgery', accurx_id: 'X1' }]);
    expect(groups.acc2.practices).toEqual([{ id: 2, name: 'Alpha Surgery', accurx_id: 'X1' }]);
    expect(unassigned).toEqual([4]);
  });

  it('ignores selected ids that do not exist', () => {
    const assignments = rebuildAssignments(practices, files);
    const { groups, unassigned } = groupSelectedByAccount([999], practices, assignments, accounts);
    expect(groups).toEqual({});
    expect(unassigned).toEqual([]);
  });
});

describe('findCrossAccountDuplicates', () => {
  it('finds one duplicate with two accounts', () => {
    const assignments = rebuildAssignments(practices, files);
    const dupes = findCrossAccountDuplicates([1, 2, 3], practices, assignments);
    expect(dupes).toHaveLength(1);
    expect(dupes[0].accurxId).toBe('X1');
    expect(dupes[0].name).toBe('Alpha Surgery');
    expect(dupes[0].entries).toEqual([
      { id: 1, accountId: 'acc1' },
      { id: 2, accountId: 'acc2' },
    ]);
  });

  it('reports nothing when the duplicated accurx_id is only selected once', () => {
    const assignments = rebuildAssignments(practices, files);
    expect(findCrossAccountDuplicates([1, 3], practices, assignments)).toEqual([]);
  });
});

describe('allocatePracticeIds', () => {
  function fakeStorage(initial: Record<string, string> = {}) {
    const store = { ...initial };
    return {
      store,
      getItem: (k: string) => (k in store ? store[k] : null),
      setItem: (k: string, v: string) => { store[k] = v; },
    };
  }

  it('never overlaps between two consecutive allocations', () => {
    const storage = fakeStorage();
    const first = allocatePracticeIds(3, storage);
    const second = allocatePracticeIds(3, storage);
    expect(first).toHaveLength(3);
    expect(second).toHaveLength(3);
    expect(new Set([...first, ...second]).size).toBe(6);
    expect(Math.min(...second)).toBeGreaterThan(Math.max(...first));
  });

  it('persists the counter through storage so a fresh call continues after it', () => {
    const storage = fakeStorage();
    const first = allocatePracticeIds(2, storage);
    const persisted = storage.getItem(NEXT_PRACTICE_ID_KEY);
    expect(persisted).not.toBeNull();

    const reloaded = fakeStorage({ [NEXT_PRACTICE_ID_KEY]: persisted! });
    const second = allocatePracticeIds(2, reloaded);
    expect(Math.min(...second)).toBeGreaterThan(Math.max(...first));
  });

  it('starts fresh when the stored counter is corrupt', () => {
    const storage = fakeStorage({ [NEXT_PRACTICE_ID_KEY]: 'not-a-number' });
    const ids = allocatePracticeIds(2, storage);
    expect(ids.every((n) => Number.isInteger(n) && n > 0)).toBe(true);
  });
});
