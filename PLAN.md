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
- **Column headers:** random, subject only to having the correct digit count for
  the drill (e.g. 1 column header per column, each a single digit in `n × 1`).
- **Row headers:** generated from **one random starting number** by the digit
  walk below. Not random per row.

### Row-number formula (3-digit rows)

Positions are counted from the **left**; the leftmost digit is the first digit.

| position | step | notes |
|---|---|---|
| first (leftmost) | **+3** | result must never be 0; if it lands on 0, substitute **3** |
| second | **−3** | 0 allowed |
| last (third) | **+3** | 0 allowed |

Each step is mod 10 (wrap past 9), applied to the *previous row's* digits. So
row *k+1* = walk(row *k*), seeded by one random start.

Verified properties (computed, all 900 three-digit starts):
- **No duplicate rows** within an 8-row or 10-row grid — every grid is distinct.
- Each digit position cycles through all ten digits; the walk has period 90, so
  long grids would eventually repeat (irrelevant at 8/10 rows).
- The leading-digit rule fires often (about 1 in 9 steps), so it is not an
  edge case — it must be in the formula's main path, not a post-hoc fix.

Sample grids (start → next 7):
```
123 → 496 769 332 605 978 241 514     (row 4: 7+3=10→0→3, so 332)
456 → 729 392 665 938 201 574 847
999 → 262 535 808 171 444 717 380
```

### Division answers: quotient + remainder

Cells in a division drill hold `qrN`, e.g. `17 ÷ 5` → `3r2`. Consequences to
settle (see Blockers): notation when the remainder is 0, and how a student
enters `r` on the answer device.

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

(`62` above would be written `62r0` or `62` — notation for zero remainder is an
open question.)

## Decided

- All tiers from the start; generators are tier-parameterized, not per-grade copies.
- Generated only — no past-paper import. Generation follows the scheme above.
- Answer entry happens **in the cell** of the drill grid. Nothing in the UI may
  assume a single-question input.
- No persistence now (in-memory session only). Keep a seam so history/backend
  can be added without touching the grid or generator code.
- Many small files, one component per file, deliberately — new behaviour means
  a new file, not a bigger one. Target: no file past roughly a screenful.
- Student only. No teacher/class/roster/dashboard views.

## Deferred

- **Fraction drills** — skipped for now by operator decision. Revisit later:
  what fraction headers look like, what a cell contains, how one is entered.

## Blockers (operator will supply)

1. **Formula generalization.** The rule as given covers exactly 3 digits
   (+3 / −3 / +3 from the left). What are the steps for `2 x 1` (2-digit rows),
   `4 x 2`, or any other digit count? Blocks generation for every drill except
   3-digit-row ones.
2. **Division constraints.** Must columns be chosen so quotients stay in some
   range, and is a negative quotient allowed in subtraction/division drills?
   ("Negatives occur at higher tiers" — unclear whether *headers* go negative
   or only *answers*.)
3. **Zero remainder notation** — `62` or `62r0`?
4. **Answer entry device.** Keyboard/numpad, on-screen keypad, or handwriting?
   Needed for the grid's input layer, especially `r` in `4r2` and negative signs.

## Phases (each independently verifiable)

### Phase 1 — Skeleton
Static page, no build step. Render a drill grid from a hardcoded spec: headers,
empty cells, one cell focused, typed digits land in the focused cell, clock
counting down, cell counter. Stub generator only.

### Phase 2 — Grid generation (waiting on blockers 1–4)
Produce a **grid spec**, not questions:
`{ name, operator, rows[], cols[], answers[][], tier }`. Column sets loaded from
data; row sequences from the formula. One module per operator/family.

### Phase 3 — Drill rules enforcement
Column-major fill order enforced (no cell selectable until its column's cells
above it are filled), no skipping, per-cell correctness on submit, timer hard
stop at 5:00 / 10:00, score = correct cells with time remaining recorded.

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
