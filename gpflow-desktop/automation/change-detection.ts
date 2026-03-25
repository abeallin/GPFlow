import crypto from 'crypto';

export interface SnapshotData {
  selectors: Record<string, string[]>;
  domHash: string;
}

export interface ChangeDetail {
  element: string;
  type: 'selector_changed' | 'selector_added' | 'selector_removed';
  old?: string;
  new?: string;
}

export interface DiffResult {
  changed: boolean;
  domHashChanged: boolean;
  changes: ChangeDetail[];
}

export function hashDom(html: string): string {
  return crypto.createHash('sha256').update(html).digest('hex');
}

export function diffSnapshots(old: SnapshotData, current: SnapshotData): DiffResult {
  const changes: ChangeDetail[] = [];
  const domHashChanged = old.domHash !== current.domHash;

  const allElements = new Set([
    ...Object.keys(old.selectors),
    ...Object.keys(current.selectors),
  ]);

  for (const element of allElements) {
    const oldSelectors = old.selectors[element];
    const currentSelectors = current.selectors[element];

    if (!oldSelectors && currentSelectors) {
      changes.push({ element, type: 'selector_added', new: currentSelectors[0] });
    } else if (oldSelectors && !currentSelectors) {
      changes.push({ element, type: 'selector_removed', old: oldSelectors[0] });
    } else if (oldSelectors && currentSelectors) {
      if (oldSelectors[0] !== currentSelectors[0]) {
        changes.push({
          element,
          type: 'selector_changed',
          old: oldSelectors[0],
          new: currentSelectors[0],
        });
      }
    }
  }

  return {
    changed: domHashChanged || changes.length > 0,
    domHashChanged,
    changes,
  };
}
