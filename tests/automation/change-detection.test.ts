import { describe, it, expect } from 'vitest';
import { diffSnapshots, hashDom } from '../../automation/change-detection';

describe('Change Detection', () => {
  it('detects no changes for identical snapshots', () => {
    const snapshot = { selectors: { emailInput: ['#email'] }, domHash: 'abc123' };
    const diff = diffSnapshots(snapshot, snapshot);
    expect(diff.changed).toBe(false);
    expect(diff.changes).toHaveLength(0);
  });

  it('detects selector changes', () => {
    const old = { selectors: { emailInput: ['#email', 'input[type=email]'] }, domHash: 'abc' };
    const current = { selectors: { emailInput: ['#user-email', 'input[type=email]'] }, domHash: 'abc' };
    const diff = diffSnapshots(old, current);
    expect(diff.changed).toBe(true);
    expect(diff.changes).toContainEqual({
      element: 'emailInput',
      type: 'selector_changed',
      old: '#email',
      new: '#user-email',
    });
  });

  it('detects DOM hash changes', () => {
    const old = { selectors: {}, domHash: 'abc123' };
    const current = { selectors: {}, domHash: 'def456' };
    const diff = diffSnapshots(old, current);
    expect(diff.changed).toBe(true);
  });

  it('produces consistent hashes for same input', () => {
    const html = '<div id="main"><button>Click</button></div>';
    expect(hashDom(html)).toBe(hashDom(html));
  });
});
