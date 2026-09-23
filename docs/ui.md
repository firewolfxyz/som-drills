# UI / interface spec (Phase 1 deliverable)

Phase 1 builds the **interface only**: the drill grid on screen, keyboard entry,
clock, and submit. Generation is stubbed. The UI must not assume any input model
other than "answers are typed into cells".

## Screens

1. **Picker** — list of drills, generated from the config set. Phase 1 may show a
   single entry (`2 x 1 addition`).
2. **Drill** — the grid plus HUD. This is the whole app in Phase 1.
3. **Result** — graded grid: per-cell correct/incorrect, score, time remaining.
   Deferred to Phase 3; stubbed in Phase 1.

## Drill screen layout

```
┌──────────────────────────────────────────────┐
│ 2 x 1 addition                    04:37  12/40 │   ← HUD: name, clock, progress
├────┬─────┬─────┬─────┬─────┬─────┤
│    │  7  │  5  │  9  │  4  │  6  │            ← column headers
├────┼─────┼─────┼─────┼─────┼─────┤
│ 12 │▓▓▓▓│     │     │     │     │            ← active cell highlighted
│ 49 │     │     │     │     │     │
│ 76 │     │     │     │     │     │
│ 33 │     │     │     │     │     │
│ 60 │     │     │     │     │     │
│ 97 │     │     │     │     │     │
│ 24 │     │     │     │     │     │
│ 51 │     │     │     │     │     │
└────┴─────┴─────┴─────┴─────┴─────┘
```

- Row headers in a left column, visually separated from the answer cells.
- Exactly `rows × cols` answer cells; no extra/hidden cells.
- The active cell is obvious at a glance (strong highlight) so eyes stay on the
  grid.
- Digits are large, monospaced/tabular, right-aligned for stable widths.
- Nothing marks correct/incorrect during the drill — echo only.

## Entry model

**Plain keyboard entry with fast advancement.** The exact commit key is decided
with the grid on screen (space bar is the current candidate).

Because work order is fixed and skipping is illegal:
- Commit advances **down one cell**.
- Committing the last cell of a column advances to the **top of the next column**.
- No arrow keys are needed for forward progress; the hand never leaves the typing
  position.
- Commit is an explicit key, never inferred from digit count — answer lengths vary
  (`19` vs `104` vs `3r2`).

Keys to settle in Phase 1:

| action | requirement |
|---|---|
| digit | appends to the active cell, echoed |
| commit | saves the cell, advances down / wraps to next column |
| backspace | clears and steps back one cell; must never leave a blank ahead |
| `r` separator | for quotient+remainder drills only (not needed for addition) |
| minus | for signed-row drills only; mode-aware, not always competing for space |

Mouse is never required. Touch support comes in Phase 5.

## Timing

- Clock counts down from the config's `seconds` and is visible throughout.
- At zero the drill stops immediately and submits whatever is filled in.
- No pause/resume in scope.

## Code layout for UI (separate from logic)

UI files render and report events; they contain no drill rules and no generation.

```
index.html          entry, no build step
css/base.css        reset + type
css/hud.css         header: name, clock, progress
css/grid.css        grid + cells + active state (swappable styling)
js/main.js          wiring only
js/ui/picker.js     drill list from configs
js/ui/drillView.js  render grid, highlight active cell, echo typed digits
js/ui/resultView.js graded grid + score (Phase 3; stub now)
```

Logic lives apart from these:

```
js/state.js         in-memory session state (spec, entries, clock, cursor)
js/rules.js         column-major order, no-skip enforcement, grading
js/timer.js         countdown helpers
js/generators/*     config validation + grid spec generation (Phase 2)
```

Rule: a UI file may not compute drill correctness, and `rules.js` may not touch
the DOM.
