import { describe, it, expect } from 'vitest';
import { getLocatorDefinitions } from '../../automation/locators';

describe('Locator Definitions', () => {
  it('defines locators for all actions', () => {
    const defs = getLocatorDefinitions();
    expect(defs.login).toBeDefined();
    expect(defs.create).toBeDefined();
    expect(defs.delete).toBeDefined();
  });

  it('each locator has at least 2 fallback strategies', () => {
    const defs = getLocatorDefinitions();
    for (const [action, locators] of Object.entries(defs)) {
      for (const [element, strategies] of Object.entries(locators as Record<string, string[]>)) {
        expect(strategies.length, `${action}.${element} needs >= 2 strategies`).toBeGreaterThanOrEqual(2);
      }
    }
  });
});
