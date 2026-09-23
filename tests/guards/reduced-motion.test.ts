import { describe, it, expect } from 'vitest';
import fs from 'fs';
import path from 'path';

/** Under prefers-reduced-motion every duration is zero, globally. See docs/ui-rules.md §9. */
const css = fs.readFileSync(path.join(__dirname, '../../src/app/globals.css'), 'utf8');

describe('reduced motion', () => {
  it('globals.css has a global prefers-reduced-motion: reduce block that zeroes every duration', () => {
    const m = css.match(/@media\s*\(prefers-reduced-motion:\s*reduce\)\s*{([\s\S]*?)}\s*}/);
    expect(m, 'no @media (prefers-reduced-motion: reduce) block').toBeTruthy();
    const block = m![1];
    expect(block).toMatch(/\*\s*,\s*\*::before\s*,\s*\*::after/);
    expect(block).toMatch(/animation-duration:\s*0\.01ms\s*!important/);
    expect(block).toMatch(/animation-iteration-count:\s*1\s*!important/);
    expect(block).toMatch(/transition-duration:\s*0\.01ms\s*!important/);
    expect(block).toMatch(/scroll-behavior:\s*auto\s*!important/);
  });
});
