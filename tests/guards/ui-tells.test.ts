import { describe, it, expect } from 'vitest';
import fs from 'fs';
import path from 'path';

/**
 * Static guards for docs/ui-rules.md. Each rule scans src/ for a pattern that the
 * rules ban. Counts are held at zero; a new hit fails the build and names the line.
 * Every detector is also run against a fixture so a broken guard fails loudly
 * instead of silently reporting zero.
 */
const SRC = path.join(__dirname, '../../src');

function walk(dir: string, out: string[] = []): string[] {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) walk(full, out);
    else if (/\.(tsx?|css)$/.test(entry.name)) out.push(full);
  }
  return out;
}

const files = walk(SRC).map((f) => ({ file: path.relative(SRC, f), text: fs.readFileSync(f, 'utf8') }));

interface Rule {
  name: string;
  why: string;
  pattern: RegExp;
  /** A snippet the detector must catch, proving it works. */
  fixture: string;
  only?: RegExp; // restrict to these files
}

const RULES: Rule[] = [
  {
    name: 'text under 11px',
    why: '§3: floor is 12px for sentence text, 11px for uppercase labels',
    pattern: /text-\[(?:[0-9]|10)px\]/g,
    fixture: '<span className="text-[10px]">x</span>',
  },
  {
    name: 'opacity-disabled controls',
    why: '§4: disabled is a muted surface with a stated reason, never an opacity fade',
    pattern: /disabled:opacity-\d+/g,
    fixture: 'className="disabled:opacity-50"',
  },
  {
    name: 'title as a control name',
    why: '§8: icon-only controls take aria-label; title never shows on touch or keyboard',
    pattern: /<(?:button|a|Link)\b[^>]*\btitle=/g,
    fixture: '<button title="Close">x</button>',
  },
  {
    name: 'gradients',
    why: '§9: no decorative gradients',
    pattern: /bg-gradient-|linear-gradient\(|radial-gradient\(/g,
    fixture: 'className="bg-gradient-to-r from-red-600"',
  },
  {
    name: 'click handlers on table headers',
    why: '§8: sortable headers put a button inside the th',
    pattern: /<th\b[^>]*\bonClick=/g,
    fixture: '<th onClick={sort}>Name</th>',
  },
  {
    name: 'raw palette classes',
    why: '§1: colour goes through the tokens',
    pattern: /\b(?:text|bg|border|ring|from|to)-(?:gray|slate|zinc|neutral|stone|red|orange|amber|yellow|lime|green|emerald|teal|cyan|sky|blue|indigo|violet|purple|fuchsia|pink|rose)-\d{2,3}\b/g,
    fixture: 'className="text-gray-400 bg-red-600"',
  },
  {
    name: 'opacity text hierarchy',
    why: '§1: text levels are solid tokens; alpha on text is banned',
    pattern: /text-text-(?:primary|secondary|muted)\/\d+/g,
    fixture: 'className="text-text-muted/70"',
  },
  {
    name: 'browser dialogs',
    why: '§5: no alert(), confirm() or prompt()',
    pattern: /(?<![\w.])(?:window\.)?(?:alert|confirm|prompt)\s*\(/g,
    fixture: 'if (confirm("Sure?")) go();',
  },
  {
    name: 'spring or bounce motion',
    why: '§9: no bounce or elastic curves',
    pattern: /type:\s*['"]spring['"]|bounce:/g,
    fixture: "transition={{ type: 'spring', bounce: 0.2 }}",
  },
  {
    name: 'external font requests',
    why: '§3: fonts are self-hosted',
    pattern: /fonts\.googleapis\.com|fonts\.gstatic\.com/g,
    fixture: "@import url('https://fonts.googleapis.com/css2?family=X');",
    only: /\.css$/,
  },
];

describe('UI rule guards (docs/ui-rules.md)', () => {
  for (const rule of RULES) {
    describe(rule.name, () => {
      it('detector catches its fixture', () => {
        rule.pattern.lastIndex = 0;
        expect(rule.fixture.match(rule.pattern)).not.toBeNull();
      });

      it(`has no hits in src/ (${rule.why})`, () => {
        const hits: string[] = [];
        for (const { file, text } of files) {
          if (rule.only && !rule.only.test(file)) continue;
          const lines = text.split('\n');
          lines.forEach((line, i) => {
            rule.pattern.lastIndex = 0;
            if (rule.pattern.test(line)) hits.push(`${file}:${i + 1}: ${line.trim()}`);
          });
        }
        expect(hits, hits.join('\n')).toEqual([]);
      });
    });
  }
});
