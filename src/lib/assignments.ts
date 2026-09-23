/**
 * Pure helpers for practice → account assignments.
 *
 * Assignments are keyed by the composite business key `${source_file}::${accurx_id}`
 * (a practice row's identity). They are NOT keyed by accurx_id alone (the same
 * practice may appear in two files assigned to two accounts) and NOT by the
 * numeric id (auto-generated, unstable across imports).
 */
import type { Account } from './accounts';
import type { RunPractice } from './ipc-client';

export interface PracticeLike {
  id: number;
  name?: string;
  accurx_id: string;
  source_file: string;
  /** CSV columns are flattened onto the row; SQLite returns only these scalar types. */
  [key: string]: string | number | boolean | null | undefined;
}

export interface UploadedFileLike {
  fileName: string;
  accountId: string | null;
}

/** Record<practiceKey, accountId> */
export type Assignments = Record<string, string>;

export interface AccountGroup {
  account: Account;
  practices: RunPractice[];
}

export interface CrossAccountDuplicate {
  accurxId: string;
  name: string;
  entries: { id: number; accountId: string }[];
}

export const NEXT_PRACTICE_ID_KEY = 'gpflow_next_practice_id';

export function practiceKey(p: { source_file?: string | null; accurx_id: string }): string {
  return `${p.source_file ?? ''}::${p.accurx_id}`;
}

/** Look up the account a practice is assigned to (by composite key). */
export function assignedAccountId(p: PracticeLike, assignments: Assignments): string | undefined {
  return assignments[practiceKey(p)];
}

export function rebuildAssignments(practices: PracticeLike[], files: UploadedFileLike[]): Assignments {
  const fileAccountMap = new Map<string, string>();
  for (const f of files) {
    if (f.accountId) fileAccountMap.set(f.fileName, f.accountId);
  }

  const assignments: Assignments = {};
  for (const p of practices) {
    if (!p.accurx_id) continue;
    const accountId = fileAccountMap.get(p.source_file);
    if (accountId) assignments[practiceKey(p)] = accountId;
  }
  return assignments;
}

export function groupSelectedByAccount(
  selectedIds: number[],
  practices: PracticeLike[],
  assignments: Assignments,
  accounts: Account[],
): { groups: Record<string, AccountGroup>; unassigned: number[] } {
  const byId = new Map<number, PracticeLike>();
  for (const p of practices) byId.set(p.id, p);
  const accountById = new Map<string, Account>();
  for (const a of accounts) accountById.set(a.id, a);

  const groups: Record<string, AccountGroup> = {};
  const unassigned: number[] = [];

  for (const id of selectedIds) {
    const practice = byId.get(id);
    if (!practice) continue;
    const accountId = assignedAccountId(practice, assignments);
    const account = accountId ? accountById.get(accountId) : undefined;
    if (!accountId || !account) {
      unassigned.push(id);
      continue;
    }
    if (!groups[accountId]) groups[accountId] = { account, practices: [] };
    groups[accountId].practices.push({
      id: practice.id,
      name: practice.name || practice.accurx_id,
      accurx_id: practice.accurx_id,
    });
  }

  return { groups, unassigned };
}

export function findCrossAccountDuplicates(
  selectedIds: number[],
  practices: PracticeLike[],
  assignments: Assignments,
): CrossAccountDuplicate[] {
  const selected = new Set(selectedIds);
  const byAccurx = new Map<string, { name: string; entries: { id: number; accountId: string }[] }>();

  for (const p of practices) {
    if (!selected.has(p.id)) continue;
    const accountId = assignedAccountId(p, assignments);
    if (!accountId) continue;
    let entry = byAccurx.get(p.accurx_id);
    if (!entry) {
      entry = { name: p.name || p.accurx_id, entries: [] };
      byAccurx.set(p.accurx_id, entry);
    }
    entry.entries.push({ id: p.id, accountId });
  }

  const result: CrossAccountDuplicate[] = [];
  for (const [accurxId, { name, entries }] of byAccurx) {
    if (new Set(entries.map((e) => e.accountId)).size > 1) {
      result.push({ accurxId, name, entries });
    }
  }
  return result;
}

export interface CounterStorage {
  getItem: (key: string) => string | null;
  setItem: (key: string, value: string) => void;
}

/**
 * Allocate `count` practice ids from a persisted monotonic counter.
 * Two consecutive allocations never overlap, and the counter survives reloads
 * because it is written back to `storage` under NEXT_PRACTICE_ID_KEY.
 */
export function allocatePracticeIds(count: number, storage: CounterStorage): number[] {
  let next = 1;
  try {
    const raw = storage.getItem(NEXT_PRACTICE_ID_KEY);
    const parsed = raw === null ? NaN : Number(raw);
    if (Number.isSafeInteger(parsed) && parsed > 0) next = parsed;
  } catch {
    // fall through with next = 1
  }

  const ids: number[] = [];
  for (let i = 0; i < count; i++) ids.push(next++);

  try {
    storage.setItem(NEXT_PRACTICE_ID_KEY, String(next));
  } catch {
    // storage unavailable; ids are still unique for this session
  }
  return ids;
}
