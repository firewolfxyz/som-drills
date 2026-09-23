# Phases

Each phase is independently verifiable. Per `subagents.md`: small self-contained
steps, one delegated agent per step, short output from each, dependent steps run
sequentially.

## Phase 1 — UI / interface only (`2 x 1 addition`)

Interface only. Grid rendered from a **hardcoded stub spec**; no real generation,
no grading.

Acceptance checks:
- Page loads by opening `index.html` directly — no server, no bundler.
- Grid renders 8 rows × 5 columns with row/column headers and no extra cells.
- Typing digits fills the active cell (echoed); commit advances down one cell;
  committing the last cell of a column lands on the top of the next column.
- Backspace steps back to the previous cell and clears it; no blank can exist
  ahead of the cursor.
- Clock counts down from 5:00 and stops the drill at zero.
- Nothing displays correctness before submit.
- UI files contain no rules and no generation (see `ui.md` code layout).

Suggested steps (one agent each):
1. Scaffold: `index.html`, css files, module loading, empty grid from stub spec.
2. Cell input + cursor: digits, commit advance, column wrap, backspace.
3. HUD: countdown clock, filled-cell counter, time-up stop.

## Phase 2 — Grid generation

Load and validate config; emit a grid spec (`{ name, operator, rows[], cols[],
answers[][], answerFormat }`). Column headers random with fixed digits; row
magnitudes from the walk; per-row signs when `signed`. One module per operator.
Verified against the reference grids in `generation.md`.

## Phase 3 — Rules enforcement and reveal

Column-major order enforced (no cell reachable before the cells above it in its
column are filled); no skipping; timer hard stop. On submit or time-up, grade
every cell in one pass, mark correct/incorrect, report score = correct cells plus
time remaining. No feedback before that point.

## Phase 4 — Catalogue growth and modes

Add config entries (multiplication, subtraction, division, signed variants,
80-cell sizes); picker grows automatically. Session summary: per-column accuracy,
missed cells, pace.

## Phase 5 — Polish / deploy

Mobile + touch entry, keyboard-only flow verified end to end, accessible contrast,
static deploy.

## Deferred (not rejected)

- **Fraction drills** — operator decision to skip for now. Unknowns: what fraction
  headers look like, what a cell contains, how one is entered.
- **Persistence / backend** — no history now; keep a seam so it can be added
  without touching the grid or generators.
- **Weak-family auto-selection** — depends on persistence.

## Non-goals

Accounts, teacher/class/roster views, leaderboards, past-paper import, print/PDF
worksheets, mobile apps.
