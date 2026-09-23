# Subagent usage guidelines (project: test1)

## Break work into small steps, one per agent

The parent session's context is small (~35k tokens). Large delegated tasks bloat
the context with their output and make long-running runs hard to steer. So:

- **Split any non-trivial task into small, self-contained steps.**
- **Delegate each step individually** — one subagent per step — instead of one
  big workflow that does everything end-to-end.
- Keep each agent's task short and specific: exact file(s) to touch, the single
  goal, and what "done" looks like.
- Ask agents for **short output** (findings list, diff summary) — not full
  reports — so results fit in the parent context.
- Run dependent steps sequentially (finish step N, read its short result, then
  launch step N+1). Only parallelize independent steps.
- Prefer `delegate`/`worker` for small implementation steps and `reviewer` for
  short focused reviews of one file/one concern at a time.
- Steer or re-launch for requirement changes rather than expecting one long run
  to absorb everything.

## Example: building a game
1. agent: scaffold + input handling only
2. agent: game loop + core mechanics only
3. agent: rendering/HUD only
4. agent: one extra feature (e.g. special foods)
5. agent: review of one concern (e.g. terminal restore, edge cases)

Each step should be completable and verifiable on its own (e.g. py_compile,
quick smoke run).
