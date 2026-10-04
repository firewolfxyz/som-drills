# Bug log

Found by reading the source against the docs (`docs/ui.md`, `docs/phases.md`,
`PLAN.md`) and reproduced headlessly before being fixed. Each fix is pinned by a
check in `tools/testBugs.js`, which CI runs with every other `tools/test*.js`
(`node tools/testBugs.js` on its own prints the table and exits non-zero on a
regression).

Severity: **critical** = a drill cannot be completed · **high** = a correct
answer is scored wrong · **medium** = wrong behaviour in a normal path ·
**low** = edge case / hygiene · **cosmetic** = wording only.

| # | Bug | Severity | Status |
|---|-----|----------|--------|
| 1 | Division drills are unanswerable: no `r` key anywhere | critical | [x] |
| 2 | Compute mode: Enter on a reopened correct cell makes it wrong | high | [x] |
| 3 | Countdown keeps running after the grid is submitted | medium | [x] |
| 4 | `#drill=` starts left-to-right, ignoring the saved entry mode | medium | [x] |
| 5 | No viewport meta tag: the phone layout never engages | medium | [x] |
| 6 | `#seed=` is silently dropped when it is not last in the fragment | low | [x] |
| 7 | `history.js` writes into localStorage on every page load | low | [x] |
| 8 | Stray `pi-llama-swap` dependency in `package.json` | low | [x] |
| 9 | App title disagrees with the plan / `<title>` | cosmetic | [x] |

---

## 1. Division drills are unanswerable — no `r` key (critical)

**Repro** — pick "2 x 1 division" (or "2 x 1 division 10x8") and try to answer
`17 / 5 = 3 r 2`.

**Expected** — `docs/ui.md` "Keys to settle in Phase 1" lists an `r` separator
"for quotient+remainder drills only", and `js/generators/divide.js` produces
answers as strings like `"3r2"`, so the student types `3`, `r`, `2`.

**Actual** — `js/keys.js` maps no key to `r`: `keys.actionFor({code:"KeyR",
key:"r"})` returns `action: "ignore"`, so the keypress is passed straight
through to the browser. `js/ui/keypadView.js` renders digits, backspace, minus
and `ok` — no `r` either, so touch entry is equally stuck. The answer can only
ever be the quotient, and `rules.grade` compares against `"3r2"`.

Measured on a seeded run of the 8x5 division drill: **34 of 40 cells** hold an
answer with a remainder, i.e. 85% of a division drill is ungradeable.

**Fix** — map `KeyR` (and the bare `r`/`R` key fallback) to a `sep` action in
`js/keys.js` (its header comment still claimed there was no `r` separator, while
`minus` had long since been added — corrected along with the mapping); accept it
in `js/state.js` as a character that is appended (left-to-right) or prepended
(right-to-left) exactly like a digit, but only for cells whose answer actually
contains `r` — a stray `r` in an addition drill is refused rather than typed
into the cell; add an `r` key to the on-screen keypad. The inserted character is
always `"r"` itself, so a caller that sends something else cannot inject text
into a cell.

**Verify** — `tools/testBugs.js`: the key mapping, the keypad key and its tap,
a whole division grid typed with `r` grading 4/4, `r` still working in
right-to-left mode (`2,r,3` → `3r2`), and a stray `r` in an addition drill being
refused.

## 2. Compute mode: Enter on a reopened correct cell makes it wrong (high)

**Repro** — picker → "digits: compute order" → start "2 x 1 multiplication".
In the first cell (`9 x 3 = 27`) type `7`, `2`: the cell completes, stores the
real answer `27` and advances. Press Backspace twice to step back into that
cell, then press Enter/Space.

**Expected** — the cell still holds `27` and still grades correct.

**Actual** — `state.onBack` reopens a completed compute cell by restoring its
*typed buffer* (`"72"`, the mental-math order) so it can be edited. Pressing
Enter then runs `onCommit`, which stores `typed[cursor]` verbatim — so the cell
now holds `"72"`, the display still reads `27` (the positional layout of the
buffer), and `rules.grade` scores it wrong. `correct` drops from 1 to 0.

**Fix** — in `onCommit`, when the cell is in compute mode and the buffer is
exactly the expected entry order for that answer, store the real answer instead
of the buffer — the same normalisation `onDigit` already does when a cell
completes under itself.

**Verify** — `tools/testBugs.js` ("grades correct" probe) and
`tools/testComputeEntry.js`.

## 3. Countdown keeps running after the grid is submitted (medium)

**Repro** — start any drill, fill the grid (or let `state.stop()` run), then
watch the interval.

**Expected** — the run is over: the clock stops, nothing else fires.

**Actual** — `js/main.js` never calls `clock.stop()` when the session ends. The
1s interval keeps running after the result screen replaces `#app`: `onTick`
keeps calling `hud.setTimeFraction` on a detached time bar, and when it finally
reaches zero it calls `state.stop()` again. Harmless only because `submit()` is
idempotent — but it is a live timer holding the drill's closure (and, on a long
drill, a second `history.record` path if the guard ever changes).

**Fix** — stop the clock in the `result.show` hook that already runs at submit.

**Fix** — stop the clock in the `result.show` hook that already runs at submit.
`tools/simulateEntry.js` had been ticking the wired clock after completion to
reach the late-expiry path, which now loops forever on a stopped clock; it
asserts the countdown stopped, then restarts the same clock to keep covering
`onExpire` after completion, with a bounded loop so a future change fails a
check instead of hanging the suite.

**Verify** — `tools/testBugs.js` ("timer interval is cleared" probe) and
`tools/simulateEntry.js` ("completing the grid stopped the countdown").

## 4. `#drill=` starts left-to-right, ignoring the saved entry mode (medium)

**Repro** — set "compute order" on the picker (it persists in `localStorage`),
then open `index.html#drill=2`.

**Expected** — the same entry mode as the picker: the saved choice is what the
student last asked for, and `docs/phases.md` treats the fragment as a shortcut
into the same session.

**Actual** — `main.js` calls `startDrill(drillIndex)` with no options, so
`rtl`/`compute`/`auto` are all off: a fragment link always starts a plain
left-to-right run. The probe shows the first cell rendering plain text instead
of compute slots.

**Fix** — `pickerView` owns the two `localStorage` keys, so it exports
`savedOptions()` (the same `{rtl, compute, auto}` object `onPick` passes) and
`render()` seeds its toggles from it; `main.js` passes
`pickerView.savedOptions()` for fragment starts.

**Verify** — `tools/testBugs.js` ("#drill= fragment honours the saved entry
mode": the first cell renders compute slots, not plain text).

## 5. No viewport meta tag: the phone layout never engages (medium)

**Repro** — open the app on a phone (or emulate one) and look at the grid.

**Expected** — `docs/phases.md` Phase 5: the grid "shrinks to fit any viewport
≥ 320px", and `css/keypad.css` carries the `@media (max-width: 40rem)` rules
that make that true.

**Actual** — `index.html` has no `<meta name="viewport">`. Mobile browsers then
lay the page out in a virtual ~980px viewport, so the 40rem (640px) media query
never matches: the cell/padding shrink and the narrowed `--rowhead` track never
apply, and the drill renders at desktop scale, shrunk to illegibility.

**Fix** — add `<meta name="viewport" content="width=device-width,
initial-scale=1">`.

## 6. `#seed=` is silently dropped when it is not last (low)

**Repro** — `index.html#seed=1234567890#drill=2`.

**Expected** — `js/main.js`'s header comment: "Both can coexist (the seed
parser scans arbitrary text)".

**Actual** — `random.parseSeed` uses `/seed=(-?\d+)(?:$|[&\s])/`; the `#`
separator is neither `&` nor whitespace nor end-of-string, so the match is
rejected and the run is **unseeded** (`Math.random`). The documented order
`#drill=2#seed=123` works, so the bug only bites in the other order — which
makes it look like the seed is being ignored at random.

**Fix** — accept `#` in the terminator class: `(?:$|[&#\s])`.

## 7. `history.js` writes into localStorage on every page load (low)

**Repro** — load `index.html` in a profile with no `som-history` key.

**Expected** — reading the history does not write to storage.

**Actual** — the usability probe at load time does
`s.setItem(STORAGE_KEY, s.getItem(STORAGE_KEY) || "{}")`, creating a `"{}"`
entry on a page view that recorded nothing. It also means a page load is
indistinguishable from a run in any storage audit, and it can throw in storage
modes where reads succeed and writes do not.

**Fix** — probe with a read (`getItem`) plus a `JSON.parse` sanity check; only
the memory fallback is created eagerly.

## 8. Stray `pi-llama-swap` dependency in `package.json` (low)

**Repro** — `cat package.json`.

**Expected** — the app is deliberately dependency-free (classic scripts, no
build, no fetch; `PLAN.md`/`docs/ui.md`), and CI (`github/workflows/pages.yml`)
runs `node tools/test*.js` with no install step at all.

**Actual** — `package.json` declares `pi-llama-swap` (an unrelated tooling
package), with a matching `package-lock.json`. Both are untracked, so the repo
is clean, but a contributor running `npm install` pulls an unrelated package
into a project that has no runtime dependencies.

**Fix** — drop the dependency and the lock file (both were untracked, and
`node_modules/pi-llama-swap` went with them). `package.json` now only declares
the project and a `test` script that mirrors the CI gate.

## 9. App title disagrees with the plan (cosmetic)

**Repro** — browser tab vs the first screen.

**Actual** — `<title>Spirit of Math Drills</title>` (and `PLAN.md`'s heading)
vs the picker's `<h1>SPIRIT OF MATH DRILLER</h1>`.

**Fix** — one name everywhere; the plan and the document title use "Spirit of
Math Drills", so the on-screen heading follows them, with
`text-transform: uppercase` on `.app-title` keeping the all-caps look.

---

## Checked and *not* bugs

Worth recording, because each looks wrong at a glance:

- **`MAX_CHARS = 6`** — the largest answer in the catalogue is 4 digits
  (`3 x 1 multiplication 10x8` tops out at 8991), and a quotient+remainder
  answer is at most 5 characters, so the cap never truncates a real answer.
- **Compute-mode display order** — typing `8,9,0` for a 3-digit answer reads
  `908`, not the typed order `890`; that is the positional layout working as
  documented, and an over-long buffer widening the cell is documented too.
- **Auto-advance with a wrong answer** — a full-length wrong buffer commits and
  advances instead of stranding the cursor; deliberate (phases.md), and covered
  by `tools/simulateEntry.js`.
- **`filled` going negative on repeated Backspace** — `rules.back` returns
  `null` at index 0, so the counter cannot drop below zero.
- **CI test gate** — `for t in tools/test*.js` is safe: every test file is
  tracked in git, so the glob always matches.
- **`state.js` reading `spec.answers`** — allowed: the docs forbid *views*
  (`entryView`) from reading answers, not the entry controller, which needs the
  answer length for auto-advance.

## Fix verification

`tools/testBugs.js` holds one assertion per bug above (18 checks, all green) and
exits non-zero if any of them regresses; CI already runs it because the gate is
`for t in tools/test*.js`. Full suite after the fixes:

| suite | checks | result |
|---|---|---|
| `testBugs.js` | 18 | pass |
| `testComputeEntry.js` | 37 | pass |
| `testConfig.js` | 23 | pass |
| `testGenerate.js` | 46 | pass |
| `testGrade.js` | 14 | pass |
| `testHistory.js` | 16 | pass |
| `testSeed.js` | 26 | pass |
| `testSummarize.js` | 12 | pass |
| `testWalk.js` | 16 | pass |
| `simulateEntry.js` | 105 | pass |
