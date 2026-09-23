import { describe, it, expect } from 'vitest';
import fs from 'fs';
import path from 'path';

/**
 * Every text token is a solid colour measured against every surface it can sit on.
 * Ratios follow the WCAG relative-luminance formula. Add a line when adding a token;
 * never assert contrast by eye. See docs/ui-rules.md §1–2.
 */
const css = fs.readFileSync(path.join(__dirname, '../../src/app/globals.css'), 'utf8');

function token(name: string): string {
  const m = css.match(new RegExp(`--color-${name}:\\s*([^;]+);`));
  if (!m) throw new Error(`token --color-${name} not found`);
  return m[1].trim();
}

function hexToRgb(hex: string): [number, number, number] {
  const h = hex.replace('#', '');
  const full = h.length === 3 ? h.split('').map((c) => c + c).join('') : h.slice(0, 6);
  const n = parseInt(full, 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

function luminance([r, g, b]: [number, number, number]): number {
  const f = (c: number) => {
    const s = c / 255;
    return s <= 0.03928 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4);
  };
  return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b);
}

export function contrast(fg: string, bg: string): number {
  const l1 = luminance(hexToRgb(fg));
  const l2 = luminance(hexToRgb(bg));
  const [hi, lo] = l1 > l2 ? [l1, l2] : [l2, l1];
  return (hi + 0.05) / (lo + 0.05);
}

const SOLID = /^#[0-9a-fA-F]{6}$/;
const surfaces = ['bg-root', 'bg-base', 'bg-raised', 'bg-overlay', 'bg-input', 'sidebar'];
const textTokens = ['text-primary', 'text-secondary', 'text-muted'];

describe('text tokens are solid colours, never opacity', () => {
  for (const t of textTokens) {
    it(`--color-${t} is a 6-digit hex`, () => {
      expect(token(t)).toMatch(SOLID);
    });
  }
  it('surfaces are solid too', () => {
    for (const s of surfaces) expect(token(s)).toMatch(SOLID);
  });
});

describe('text on every surface clears 4.5:1', () => {
  for (const t of textTokens) {
    for (const s of surfaces) {
      it(`${t} on ${s}`, () => {
        expect(contrast(token(t), token(s))).toBeGreaterThanOrEqual(4.5);
      });
    }
  }
});

describe('status text clears 4.5:1 on the raised surface', () => {
  // `error` is a fill (destructive button); `error-text` is the readable counterpart.
  for (const t of ['warning', 'error-text', 'info', 'accent']) {
    it(`${t} on bg-raised`, () => {
      expect(contrast(token(t), token('bg-raised'))).toBeGreaterThanOrEqual(4.5);
    });
  }
});

describe('control boundaries clear 3:1', () => {
  it('edge on bg-base and bg-input', () => {
    expect(contrast(token('edge'), token('bg-base'))).toBeGreaterThanOrEqual(3);
    expect(contrast(token('edge'), token('bg-input'))).toBeGreaterThanOrEqual(3);
  });
  it('accent (focus ring, primary fill) on bg-base', () => {
    expect(contrast(token('accent'), token('bg-base'))).toBeGreaterThanOrEqual(3);
  });
  it('ink on accent (primary button label)', () => {
    expect(contrast(token('text-on-accent'), token('accent'))).toBeGreaterThanOrEqual(4.5);
  });
  it('white on error (destructive confirm label)', () => {
    expect(contrast('#FFFFFF', token('error'))).toBeGreaterThanOrEqual(4.5);
  });
});
