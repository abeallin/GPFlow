# GP Flow UI rules

Distilled from the house standards in `xg-platform/docs/{accessibility,usability,aesthetics}.md`,
`xg-platform/docs/design/prototypes/style/NO-AI-TELLS.md` and `cabeazy/docs/operator-aesthetics.md`,
adapted to this app: a dark-themed desktop tool a practice administrator uses for long stretches,
with a web build for data management only. Read this before changing anything a user sees.
`tests/guards/` enforces the mechanical parts and its counts can only go down.

The one-line summary: **a calm dark instrument, one green accent that means something, solid text
tokens measured for contrast, and nothing destructive without a confirmation.** Density and
legibility beat decoration.

## 1. Tokens are the interface

- Every colour goes through the `@theme` tokens in `src/app/globals.css`, used as Tailwind classes
  (`bg-bg-base`, `text-text-secondary`, `border-border`). No raw palette classes (`text-gray-400`,
  `bg-red-600`) and no hex literals in components.
- **Never express text hierarchy with opacity.** The three text levels are solid colours:
  `text-text-primary`, `text-text-secondary`, `text-text-muted`. Each is measured against
  `bg-bg-root`, `bg-bg-base` and `bg-bg-raised`; `tests/guards/contrast-tokens.test.ts` holds the
  ratios. Anything fainter than `text-muted` is a line, never text.
- Alpha modifiers on text (`text-text-muted/70`) are banned. Use them only for non-text fills.
- The dark theme is a decision on record; there is no light mode and no `dark:` classes.

## 2. Contrast is a gate

- Text 4.5:1, large text (24px, or 18.66px bold) 3:1, control boundaries, focus rings and
  meaningful icons 3:1. Measure with the formula, never by eye.
- The accent (`#10E0A0`) is a fill and a stroke. As text it passes on the dark surfaces, so
  `text-accent` is allowed for links and status words, but the label on an accent fill is
  `text-text-on-accent` (ink), never white.
- Every status colour has a word or an icon beside it. Colour never carries meaning alone.
  At most one urgent colour per table row.

## 3. Type

- Two families, self-hosted, no third-party request: Instrument Serif for the display face
  (`h1`, the logo), Manrope for everything else. Monospace is the system stack.
- One `h1` per page, in the display face. Section headings are Manrope, sentence case, 12px 600,
  in `text-text-secondary`. Uppercase is reserved for data-table column headers (11px, 600,
  0.06em tracking, `text-text-secondary`).
- **Size floor: 12px for sentence text, 11px for uppercase labels.** `text-[10px]` is banned.
- Line height at least 1.3 for anything that can wrap. Prefer `min-h-*` to `h-*` around text.
- Counts and numbers that line up in a column take `tabular-nums` and align right.
- Copy is UK English, sentence case, no exclamation marks, never blames the user, and says what is
  safe when something fails ("Nothing has changed").

## 4. Buttons and disabled controls

| Action | Style |
|---|---|
| Primary | Solid accent, ink label |
| Secondary | Ghost: text plus optional icon, no fill, border or shadow |
| Destructive | Solid `error` fill, only inside `ConfirmDialog`, after a focused Cancel |
| Row or toolbar action | Icon-only ghost with an `aria-label` naming the action and its object |

- **Disabled is a muted surface with a border and a stated reason, never an opacity fade.**
  `disabled:opacity-*` is banned. Prefer `aria-disabled="true"` plus refusing the press in the
  handler, so the control keeps its place in the tab order and its reason can be read.
- A button that is working keeps its width and says what it is doing ("Deleting…").
- Every pointer target clears 24×24 CSS px; primary actions clear 44×44.
- One focus indicator everywhere: the global `:focus-visible` outline in `globals.css`.
  Components must not override it with `outline-none`.

## 5. Dialogs

- **Irreversible or bulk actions confirm.** Bulk create, bulk delete, clear all data, remove an
  account. The dialog names the thing and the count: title "Delete 'Flu 2024' from 42 practices?",
  confirm label "Delete on 42 practices".
- Every overlay is `ConfirmDialog` or `DialogPanel` from `src/components/ui/`: `role="dialog"` or
  `alertdialog`, `aria-modal`, named by its heading, focus moves in, Tab wraps, Escape closes,
  focus returns to the opener.
- Cancel comes first in reading order and tab order, and has initial focus when the action is
  destructive.
- Confirming disables the button and relabels it. Failure keeps the dialog open, shows the error,
  and says what is safe.
- No `alert()`, `confirm()` or `prompt()`.

## 6. Unknown is not empty

| Truth | Must never render as |
|---|---|
| empty: we asked, there is none | — |
| unknown: we could not ask, or it failed | "No practices", "0 runs", "Never" |

- A page that failed to load renders `LoadError` with a Retry button in place of the table and its
  empty state, never both. It is not dismissable.
- **A zero is a claim.** Stat tiles and counts show "—" until the data has arrived.
- A toast is not an error state. An error about a form belongs next to the form or field.
- Every list has three designed states. Empty: a muted icon, a one-line heading, one line saying
  what will appear there. Loading: skeleton blocks the shape of the real rows, `aria-busy` on the
  region. Error: the empty layout plus Retry.

## 7. Feedback

- One toast stack and one pair of live regions, mounted once in the root layout. Every outcome
  goes through `toast()` and `announce()`. Success is `polite`; `assertive` only for failures where
  carrying on would do harm.
- Success toasts last at least 6s and pause while hovered or focused. Error toasts stay until
  closed.
- The fixed toast stack must never cover the element that has focus.

## 8. Keyboard and names

- Click handlers go on `<button>` or `<a>`, never on `div`, `span`, `th` or `tr` alone. A row may
  take a mouse `onClick` only if the same action is available on a real control inside it.
- Sortable headers put a `<button>` inside the `<th>` and set `aria-sort`.
- A skip link is the first focusable element and targets `<main id="main" tabindex="-1">`.
- Every route sets a unique document title ("Data · GP Flow").
- **Never `title` as a control's name.** Icon-only controls take `aria-label`; the icon is
  `aria-hidden`. An icon next to text is decorative.
- Every input, select and textarea has a visible label tied by `htmlFor`/`id`; hints and errors are
  linked with `aria-describedby` and the field sets `aria-invalid`. A placeholder is not a label.
- Tabs use `role="tablist"`, `tab` and `tabpanel`, move with arrow keys, and keep their panels
  mounted so typed input survives a switch.

## 9. Surfaces, shape and motion

- Two elevation levels per screen: the page ground and a raised panel. A panel lifts with a
  subtle border **or** a shadow, not both. No glow shadows on static surfaces.
- Radii: 8px controls, 12px cards, 16px dialogs. No values in between.
- No gradients (the only allowed one is a progress fill), no noise textures, no decorative dots
  in pills, no bullet glyphs, no tick-circle lists.
- Motion confirms, it does not decorate: 150ms for small feedback, 250ms default, ease-out on
  enter, ease-in on leave. No bounce or spring. No page-entry slides and no staggered card
  entrances. Under `prefers-reduced-motion` every duration is zero (global rule in `globals.css`).

## 10. Engineering

- Variants are a typed `Record<Variant, string>` lookup; `className` is appended last.
- Pure presentation logic (status maps, formatters, grouping) lives in `src/lib/*.ts` with tests.
- `pnpm lint` (ESLint with Next and jsx-a11y rules) and `pnpm test` (including `tests/guards/`)
  pass before a commit. A guard count may fall; a rise fails the build.
- Review against `pnpm build` plus the packaged app, not only the dev server.

## Checklist before merging UI

- [ ] New colours are tokens; any new text pair is measured and its ratio is in the contrast test
- [ ] No text under 12px (11px for uppercase), no opacity text hierarchy, no `disabled:opacity`
- [ ] Destructive and bulk actions confirm, name the count, and focus Cancel first
- [ ] Forced a failure: no page shows an empty state, a zero or "Never" for unknown data
- [ ] Icon-only controls have `aria-label`, not `title`; every field has a visible linked label
- [ ] Tabbed through the change: focus visible at every stop, nothing unreachable, no trap
- [ ] Outcomes announced and toasted; error toasts stay until closed
- [ ] Checked with reduced motion on
- [ ] `pnpm lint` and `pnpm test` pass, guard baselines unchanged or lower
