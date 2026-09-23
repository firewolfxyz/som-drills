# Spirit of Math Drills — Plan (draft v1)

Goal: a web page where students drill the mental-math skills tested in the
Spirit of Math / Spirit of Mathematical Sciences contest — fast, keyboard-first,
scored on speed *and* accuracy.

## Decided

- **Tiers:** all grades (2–4, 5–6, 7–8) from the start. Generators must be
  tier-parameterized, not written per-grade as separate systems.
- **Question source:** generated only — *no* import of past contest papers.
  Generation is not naive random: it follows a specific scheme the operator
  will specify (see *Deferred specs*).
- **Answer entry:** a **drill grid** (special answer-entry surface), not
  multiple choice and not a plain text field. Design to be specified by the
  operator (see *Deferred specs*). Everything UI-side must therefore treat
  answer entry as one pluggable component, not hard-code an input element.
- **Persistence:** none now. In-memory session state only. Keep a thin seam so
  history/backend can be added later without touching generators or the grid.
- **Structure:** many small files, one component per file — deliberately, to
  keep any single file cheap to load into context. No monolithic app file.
- **Audience:** student only. No teacher, class, roster, or dashboard views.

## Deferred specs (blocking details, operator will supply)

1. **Generation scheme** — how questions are produced: seeded families? fixed
   per-tier question templates? difficulty ladders? answer-range constraints?
   *Blocks Phase 2.*
2. **Drill grid** — layout, cell contents, how digits/signs/fractions are
   composed, keyboard/mouse/touch interaction, validation feedback.
   *Blocks Phase 1's answer-entry area and Phase 3.*

Nothing is to be built until the operator says so; work stays in planning.

## Proposed phases (each independently verifiable)

### Phase 1 — Skeleton
Static shell: single page, no build step. Drill screen with a question,
drill-grid placeholder, timer, score readout. Run locally, click through.
Answer entry behind an interface (`present(question)`, `submit(answer)`,
`onResolve`) so the real grid can replace the stub unchanged.

### Phase 2 — Generators (waiting on generation scheme)
One module per skill family, each returning `{prompt, answer, tolerance?, tier, family}`:
whole-number arithmetic, order of operations, fractions/decimals/percents,
number sense & estimation, patterns/sequences, geometry (perimeter/area),
time & money, counting. Difficulty knobs per family.

### Phase 3 — Drill modes (waiting on drill grid)
- *Rapid fire*: N questions, countdown clock, typed answers.
- *Sprint*: single hard question, personal best time.
- *Mastery*: repeats until a family is above an accuracy threshold.
Session summary with per-family accuracy and average response time.

### Phase 4 — Progress & persistence
localStorage streaks, per-family stats, weak-family auto-selection,
review screen for missed questions. Optional later: export/import progress.

### Phase 5 — Polish / deploy
Mobile layout, keyboard-only flow, accessible contrast, static deploy
(GitHub Pages or plain static host).

## Non-goals
Accounts, teacher/class views, leaderboards, past-paper import, print/PDF
worksheets, mobile apps. Persistence and backend are deferred, not rejected.

## File layout (proposal)

```
index.html          entry, no build step
css/base.css        reset + type
css/drill.css       question/stage chrome
css/grid.css        drill grid (isolated so its styling is swappable)
js/main.js          wiring only
js/state.js         session state, in-memory
js/timer.js         clock + scoring helpers
js/generators/index.js   registry: family -> generator, tier-aware
js/generators/<family>.js one file per skill family
js/grid/            drill grid component (TBD once specified)
```

Rule: no file grows past roughly a screenful; new behaviour means a new file,
not a bigger one.

## Working agreement
Per `subagents.md`: small self-contained steps, one delegated agent per step,
short output from each, dependent steps run sequentially.
