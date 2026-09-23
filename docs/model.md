# Drill model

A drill is a **grid**. Each row carries a header number (left edge); each column
carries a header number (top edge). Every cell holds the result of one operation —
the *same* operation everywhere in the drill — applied to its row header and its
column header. The student writes the answer into the cell itself.

There is no question stream and no single-question input. The grid is the
exercise.

## Naming

`<row digits> x <column digits> <operator>`

*3 × 1 multiplication* = 3-digit numbers down the rows, 1-digit numbers across
the top.

## Sizes and time limits

| grid | cells | limit | pace |
|---|---|---|---|
| 8 rows × 5 cols | 40 | 5 min | 7.5 s/cell |
| 10 rows × 8 cols | 80 | 10 min | 7.5 s/cell |

Both limits encode the same required speed, doubled.

## Order of work

- No skipping.
- A column is completed **top to bottom** before the next column starts.
- Work order is vertical-first, then left-to-right.

Within one column one operand is fixed, so a column is the same mental act
repeated — that is where the fluency comes from.

## Operators

The four (`+ − × ÷`). One drill uses exactly one operator; no mixing within a
grid. Fractions exist as a drill family but are deferred (see `phases.md`).

## Numbers

- Headers are integers, never decimals.
- Column headers: random, with **exactly** the configured digit count, never
  negative.
- Row headers: generated from one random start by the walk in `generation.md`.
  May be negative at higher tiers.
- Cell answers are integers. Division cells are quotient+remainder
  (`3r2`, see `generation.md`).

## No worked examples

No filled-in example cells are shown before a drill starts.
