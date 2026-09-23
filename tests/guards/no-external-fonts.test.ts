import { describe, it, expect } from 'vitest';
import fs from 'fs';
import path from 'path';

/**
 * Fonts are self-hosted. The renderer must never make a third-party request for type:
 * no Google Fonts import, no gstatic URL, no http(s) URL of any kind in the stylesheet,
 * and every local font file the stylesheet points at must actually ship in public/.
 * See docs/ui-rules.md §3.
 */
const root = path.join(__dirname, '../..');
const cssPath = path.join(root, 'src/app/globals.css');
const css = fs.readFileSync(cssPath, 'utf8');

describe('globals.css fonts are self-hosted', () => {
  it('contains no Google Fonts or other external URL', () => {
    expect(css).not.toMatch(/googleapis/i);
    expect(css).not.toMatch(/gstatic/i);
    expect(css).not.toMatch(/url\(\s*['"]?https?:/i);
    expect(css).not.toMatch(/@import\s+url\(\s*['"]?https?:/i);
  });

  it('declares @font-face rules for the two families', () => {
    expect(css).toMatch(/@font-face\s*{[^}]*font-family:\s*['"]Instrument Serif['"]/);
    expect(css).toMatch(/@font-face\s*{[^}]*font-family:\s*['"]Manrope['"]/);
    expect(css).not.toMatch(/JetBrains/);
  });

  it('every url(/fonts/...) it references exists under public/', () => {
    const refs = [...css.matchAll(/url\(\s*['"]?(\/fonts\/[^'")]+)['"]?\s*\)/g)].map((m) => m[1]);
    expect(refs.length).toBeGreaterThan(0);
    for (const ref of refs) {
      const file = path.join(root, 'public', ref);
      expect(fs.existsSync(file), `${ref} missing from public/`).toBe(true);
      expect(fs.statSync(file).size, `${ref} is empty`).toBeGreaterThan(1000);
    }
  });

  it('uses font-display: swap on every @font-face', () => {
    const faces = css.match(/@font-face\s*{[^}]*}/g) ?? [];
    expect(faces.length).toBeGreaterThan(0);
    for (const face of faces) expect(face).toMatch(/font-display:\s*swap/);
  });

  it('monospace is the system stack', () => {
    expect(css).toMatch(/--font-mono:\s*ui-monospace,\s*SFMono-Regular,\s*Menlo,\s*Consolas,\s*monospace/);
  });
});
