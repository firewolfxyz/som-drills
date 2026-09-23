# Spirit of Math Drills — Plan (draft v2)

Goal: a web page that replicates the SOM **drill**: a grid of cells the student
fills in under a clock. The grid is not an answer widget beside a question
stream — the grid *is* the exercise. No question-by-question flow exists.

## The drill model (authoritative, from operator)

A drill is a grid. Each **row** carries a header number (left edge), each
**column** carries a header number (top edge). Every cell holds the result of
one operation — the *same* operation everywhere in the drill — applied to its
row header and column header. The student writes the answer into the cell.

- **Naming:** `<row digits> x <col digits> <operator>`, e.g. *3 × 1
  multiplication* = 3-digit numbers down the rows, 1-digit numbers across the
  top.
- **Sizes:** 8 rows × 5 columns = **40 cells / 5 min**; 10 rows × 8 columns =
  **80 cells / 10 min**. Both are exactly **7.5 s per cell** — the two limits
  encode one required pace, doubled.
- **Order:** no skipping. A column is completed top-to-bottom before the next
  column starts. Work order is vertical-first, then left-to-right.
- **Operators:** the four (`+ − × ÷`) plus **fractions**. One drill uses one
  operator; no mixing within a grid.
- **Numbers:** headers are integers, never decimals. Negatives occur at higher
  tiers. Cell answers are integers. Division answers are **quotient +
  remainder**, written `4r2`.
- **No worked example cells** are shown before starting.
- **Column headers:** random, with **exactly** the digit count the config
  specifies — never negative.
- **Row headers:** generated from **one random starting number** by the digit
  walk below. Not random per row.

### Row-number formula

Positions are counted from the **left**; the leftmost digit is the first digit.
Steps **alternate from +3, starting at the leftmost digit**: even positions get
`+3`, odd positions get `−3`. Every step wraps mod 10 and is applied to the
*previous* row's digits, so row *k+1* = walk(row *k*), seeded by one random start.

| digits | steps (left → right) |
|---|---|
| 1 | `+3` |
| 2 | `+3 −3` |
| 3 | `+3 −3 +3` |

**Leading-digit rule:** the leftmost digit must never be 0; when a step lands it
on 0, substitute **3**. Other positions may be 0.

Verified (computed over every start of each length):
- **No duplicate rows** within 8-row or 10-row grids for 2-, 3- and 4-digit rows.
- **1-digit rows have period 9**, so a 10-row grid would repeat its first row.
  Confirmed by operator: **the 80-cell grid never has 1-digit rows.** The config
  loader should reject that combination rather than silently truncating.
- The leading-digit rule fires often (~1 in 9 steps), so it belongs in the
  formula's main path, not a post-hoc fix.

Verified properties (computed, all 900 three-digit starts):
- **No duplicate rows** within an 8-row or 10-row grid — every grid is distinct.
- Each digit position cycles through all ten digits; the walk has period 90, so
  long grids would eventually repeat (irrelevant at 8/10 rows).
- The leading-digit rule fires often (about 1 in 9 steps), so it is not an
  edge case — it must be in the formula's main path, not a post-hoc fix.

Sample grids (start → next 7):
```
1-digit 7   → 3 6 9 2 5 8 1
2-digit 12  → 49 76 33 60 97 24 51
3-digit 123 → 496 769 332 605 978 241 514   (row 4: 7+3=10→0→3, so 332)
3-digit 999 → 262 535 808 171 444 717 380
```

### Signs

- **Column headers are never negative.**
- **Row headers may be negative**; the sign is chosen randomly per row, and the
  drill *type* identifies whether a drill uses signed rows (so it is known before
  the grid appears, not discovered).
- The digit walk runs on the **magnitude**; signs are assigned independently per
  row (confirmed). So `123 → 496 → …` may surface as `123, −496, 769, …`.
- **No division with negatives.** Division drills have unsigned rows; a config
  combining division and signed rows is invalid.

### Division answers: quotient + remainder

Cells in a division drill hold `qrN`, e.g. `17 ÷ 5` → `3r2`. **When the remainder
is 0, only the quotient is written** — `62`, never `62r0`. So entry length varies
per cell (see input design). Division rows are always positive.

### Example: `3 x 1 multiplication`, 8 rows × 5 columns, 5 min

Rows from the formula (start 123); columns random single digits.

```
              │   7     6     9     8     3      ← column headers (1 digit)
──────────────┼────────────────────────────────
   123        │  861   738  1107   984   369
   496        │ 3472  2976  4464  3968  1488
   769        │ 5383  4614  6921  6152  2307
   332        │ 2324  1992  2988  2656   996
   605        │ 4235  3630  5445  4840  1815
   978        │ 6846  5868  8802  7824  2934
   241        │ 1687  1446  2169  1928   723
   514        │ 3598  3084  4626  4112  1542
```

Work order: down the `7`-column (861, 3472, 5383, …), then down the `6`-column.
One fixed operand per column, so each column is the same mental act repeated —
that is where the fluency comes from.

### Example: `3 x 1 division`, same rows, columns are divisors

```
              │   7        6        9        8        3
──────────────┼──────────────────────────────────────────
   123        │ 17r4     20r3      13r6     15r3     41
   496        │ 70r6     82r4      55r1     62       165r1
   ...
```

Note `123 ÷ 8 = 15r3` but `496 ÷ 8 = 62` — a zero remainder is written as the
quotient alone.

## Decided

- All tiers from the start; generators are tier-parameterized, not per-grade copies.
- Generated only — no past-paper import. Generation follows the scheme above.
- Answer entry happens **in the cell** of the drill grid, on a **keyboard**,
  optimized for speed (see *Answer entry*). Nothing in the UI may assume a
  single-question input.
- No persistence now (in-memory session only). Keep a seam so history/backend
  can be added without touching the grid or generator code.
- Many small files, one component per file, deliberately — new behaviour means
  a new file, not a bigger one. Target: no file past roughly a screenful.
- Student only. No teacher/class/roster/dashboard views.

## Deferred

- **Fraction drills** — skipped for now by operator decision. Revisit later:
  what fraction headers look like, what a cell contains, how one is entered.

## Still open (non-blocking)

1. **Actual catalogue entries** — the concrete list of drills to ship first. Can
   be authored incrementally; Phase 2 only needs one valid entry to test against.
2. **Key layout specifics** for entry (which physical keys for commit / `r` /
   minus / back). Decide during Phase 1 with the grid on screen rather than in
   the abstract.
3. **Tier semantics.** Whether tier is a property of a config entry or just a
   label used to filter the picker.

## First drill: `2 x 1 addition`

The build targets this one drill first; everything else is later config.

```json
{
  "name": "2 x 1 addition",
  "operator": "add",
  "rows":    { "count": 8, "digits": 2, "signed": false },
  "columns": { "count": 5, "digits": 1 },
  "seconds": 300,
  "answer":  "integer"
}
```

Sample grid — rows from the walk seeded at 12, columns random single digits:

```
            │   7    5    9    4    6
────────────┼──────────────────────────
      12    │  19   17   21   16   18
      49    │  56   54   58   53   55
      76    │  83   81   85   80   82
      33    │  40   38   42   37   39
      60    │  67   65   69   64   66
      97    │ 104  102  106  101  103
      24    │  31   29   33   28   30
      51    │  58   56   60   55   57
```

Answer widths vary (2–3 digits: `19` vs `104`) even in this simplest drill —
which is why commit cannot be inferred from digit count. 2-digit rows are valid
for both the 40-cell and the 80-cell grid (no cycling).

## Answer entry: keyboard, optimized for speed

Design constraints, to be settled before Phase 1's input layer.

Confirmed direction: **plain keyboard entry with fast advancement**; the exact
commit key is decided later (space bar is the current candidate). Below is option
analysis, not a decision.

The grid's work order is fixed — down a column, then the next column to the
right — and the student may not skip. That makes the good default obvious:
**typing an answer commits it and advances down; committing the last cell of a
column advances to the top of the next column.** No arrow keys needed for
forward progress, so the hand never leaves the typing position.

Proposals to evaluate:
- **Numpad-first layout**, digits large and hit-target friendly; usable from
  either the main-row numbers or the numpad without reaching.
- **Auto-advance on commit** (Enter/Space) rather than on digit-count, since
  answer lengths vary (`41` vs `3472` vs `3r2`) — counting digits cannot know
  when an answer is finished.
- **A single key for the `r` separator** in quotient+remainder, placed where the
  hand already rests; possibly the same key as commit-with-separator.
- **Minus sign** needed only in signed drills (negative rows) — so it can be a
  mode-aware key rather than always competing for space.
- **Backspace/Left** to step back one cell for correction without breaking the
  no-skip rule; corrections never create blanks ahead.
- **Live cell highlighting** of the active cell so eyes stay on the grid, and no
  mouse required at any point.
- **Echo while typing, but no checking until the end.** The student sees what
  they typed; nothing marks right/wrong mid-drill. Correctness is revealed only
  after submit or time-up.

## Drill catalogue = configuration

The catalogue is **data, not code**. One config entry per drill defines: name,
operator, grid size, row digit count, column digit count, whether signed rows are
allowed, and time limit. Adding a drill means adding an entry — no new modules.

Proposed shape (JSON, one file per tier or one file with all):

```json
{
  "name": "3 x 1 multiplication",
  "operator": "multiply",
  "rows":    { "count": 8,  "digits": 3, "signed": false },
  "columns": { "count": 5,  "digits": 1 },
  "seconds": 300,
  "answer":  "integer"
}
```

`answer` is `integer` or `quotientRemainder`. Sizes pair with time: 8×5 → 300 s,
10×8 → 600 s (both 7.5 s/cell).

**Validation rules the loader must enforce** (fail loudly at load, not at play):
- `rows.digits ≥ 2` when `rows.count === 10` (1-digit rows cycle at 9).
- `operator !== "divide"` when `rows.signed` is true.
- `answer === "quotientRemainder"` only for division; integer otherwise.
- `rows.count * columns.count` must match the declared time limit's pace
  (40/300 or 80/600).
- Column headers generated with exactly `columns.digits` digits, never negative;
  row magnitudes with exactly `rows.digits` digits.

**The picker is generated from the configs.** No hand-maintained menu: the list of
drills shown to a student *is* the validated config set, so adding a drill makes it
appear in the picker with no other change.

Consequence for code: generators take a validated config and emit a grid spec.
The registry maps `operator → generator`; nothing else branches on drill identity.

## Phases (each independently verifiable)

### Phase 1 — Skeleton
Static page, no build step. Render a drill grid from a hardcoded spec: headers,
empty cells, one cell focused, typed digits land in the focused cell, clock
counting down, cell counter. Stub generator only.

### Phase 2 — Grid generation
Load and validate config; produce a **grid spec**, not questions:
`{ name, operator, rows[], cols[], answers[][], answerFormat }`. Column headers
from random-with-fixed-digits; row magnitudes from the walk, signs assigned per
row when `signed`. One module per operator.

### Phase 3 — Drill rules enforcement and reveal
Column-major fill order enforced (no cell selectable until its column's cells
above it are filled), no skipping, timer hard stop at 5:00 / 10:00. On submit or
time-up: grade every cell against the spec in one pass, mark correct/incorrect,
report score = correct cells plus time remaining. No feedback before that point.

### Phase 4 — Drill catalogue & modes
Pick a drill by name (`3 x 1 multiplication`, `2 x 1 fractions`, …) and size;
run 40-cell or 80-cell. Session summary: per-column accuracy, missed cells,
pace. (Weak-family selection deferred with persistence.)

### Phase 5 — Polish / deploy
Mobile + touch entry, keyboard-only flow, accessible contrast, static deploy.

## Non-goals
Accounts, teacher/class views, leaderboards, past-paper import, print/PDF
worksheets, mobile apps. Persistence and backend are deferred, not rejected.

## File layout (proposal)

```
index.html              entry, no build step
css/base.css            reset + type
css/drill.css           page chrome, clock, score
css/grid.css            the drill grid (isolated: swappable styling)
js/main.js              wiring only
js/state.js             session state, in-memory
js/timer.js             clock + pace helpers
js/rules.js             column-major order, no-skip enforcement
js/generators/index.js  registry: operator -> generator
js/generators/rows.js   the row-number formula (isolated, it is the spec's core)
js/generators/columns.js pre-generated header sets (data)
js/generators/<op>.js   one file per operator/family
js/grid/                drill grid component: render + cell input
```

## Working agreement
Per `subagents.md`: small self-contained steps, one delegated agent per step,
short output from each, dependent steps sequential. Planning only until the
operator says continue — nothing is built before then.
