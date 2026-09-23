# Generation

Generators take a validated config (see `config.md`) and emit a **grid spec**,
never individual questions:

```js
{ name, operator, rows: [..], cols: [..], answers: [[..]], answerFormat }
```

## Row-number walk

Row headers come from **one random starting number**; every later row is derived
from the previous one. Positions are counted from the **left** (leftmost digit is
the first digit). Steps **alternate from +3 starting at the leftmost digit**:
even positions `+3`, odd positions `−3`. Each step wraps mod 10.

| digits | steps (left → right) |
|---|---|
| 1 | `+3` |
| 2 | `+3 −3` |
| 3 | `+3 −3 +3` |

**Leading-digit rule:** the leftmost digit must never be 0. When a step lands it
on 0, substitute **3**. Other positions may be 0. This fires about once every 9
steps — main path, not an edge case.

```
1-digit 7   → 3 6 9 2 5 8 1
2-digit 12  → 49 76 33 60 97 24 51
3-digit 123 → 496 769 332 605 978 241 514   (row 4: 7+3=10→0→3 ⇒ 332)
3-digit 999 → 262 535 808 171 444 717 380
```

Verified properties (computed over every start of each length):
- No duplicate rows within an 8-row or 10-row grid for 2-, 3- and 4-digit rows.
- **1-digit rows have period 9**, so a 10-row grid would repeat its first row.
  Operator confirmation: the 80-cell grid never has 1-digit rows. The loader must
  reject that combination rather than silently truncating.

## Column headers

Random, each with exactly `columns.digits` digits, never negative. No lower-bound
or exclusion rules beyond digit count unless a config adds them.

## Signs

- Columns are never negative.
- Rows may be negative; the sign is chosen **randomly per row**, and the drill
  type declares whether signed rows are in play (known before the grid appears).
- The walk runs on the **magnitude**; signs are assigned independently per row.
  `123 → 496 → …` may surface as `123, −496, 769, …`.
- **No division with negatives.** Division drills have unsigned rows.

## Division answers: quotient + remainder

A division cell holds `quotient r remainder`, e.g. `17 ÷ 5` → `3r2`.
**When the remainder is 0, only the quotient is written** — `62`, never `62r0`.
Answer length therefore varies per cell, which is why commit cannot be inferred
from digit count.

## Reference grids

### `3 x 1 multiplication`, 8×5, start 123, columns random single digits

```
              │   7     6     9     8     3
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

### `3 x 1 division`, same rows, columns are divisors

```
              │   7      6      9      8     3
──────────────┼──────────────────────────────────
   123        │ 17r4   20r3   13r6   15r3    41
   496        │ 70r6   82r4   55r1     62   165r1
```

`123 ÷ 8 = 15r3` but `496 ÷ 8 = 62` — zero remainder is written as the quotient
alone.

### `2 x 1 addition`, 8×5, start 12 (first drill to build)

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

Answer widths vary (2–3 digits) even in this simplest drill.
