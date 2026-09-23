# Spirit of Math Drills — Plan

A web app that replicates the SOM **drill**: a grid of cells the student fills in
under a clock. The grid is not an answer widget beside a question stream — the
grid *is* the exercise.

Details live in `docs/`, one concern per file:

| file | contents |
|---|---|
| [docs/model.md](docs/model.md) | what a drill is: grid, naming, sizes, work order |
| [docs/generation.md](docs/generation.md) | row-number walk, column headers, signs, division format, reference grids |
| [docs/config.md](docs/config.md) | catalogue as configuration; validation rules; picker |
| [docs/ui.md](docs/ui.md) | interface spec: screens, layout, keyboard entry, code layout |
| [docs/phases.md](docs/phases.md) | phases with acceptance checks, deferred items, non-goals |

## Decided

- All tiers supported by design; generators are parameterized, not per-grade copies.
- Generated-only drills, no past-paper import.
- Answers typed **into grid cells** on a keyboard, optimized for speed.
- Echo while typing; correctness revealed only at submit/time-up.
- Catalogue is config data; the picker is generated from it.
- No persistence now (in-memory session state), with a seam kept for later history.
- Many small files, one component per file; UI separate from rules and generators.
- Student only.
- First drill to build: `2 x 1 addition` (8×5, 300 s).

## Working agreement

Per `subagents.md`: small self-contained steps, one delegated agent per step,
short output from each, dependent steps sequential. Nothing is built until the
operator says continue.
