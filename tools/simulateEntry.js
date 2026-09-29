/* Headless harness for entry behaviour (not part of the app; js/ is untouched).
   Shims just enough DOM to run the real files loaded in dependency order by
   index.html, then drives synthetic key events through the listener main.js
   registers. Run: node tools/simulateEntry.js */

const fs = require("fs");
const path = require("path");
const vm = require("vm");
const root = path.join(__dirname, "..");

/* ---------- minimal DOM shim ---------- */
function makeNode(tag) {
  const node = {
    tag: tag,
    _class: "",
    dataset: {},
    children: [],
    _text: "",
    appendChild(child) { node.children.push(child); return child; },
    querySelector(selector) { return node.querySelectorAll(selector)[0] || null; },
    querySelectorAll(selector) {
      /* Class chains are written ".cell.answer" — split on dots, not spaces. */
      const cls = selector.split(".").filter(Boolean);
      const out = [];
      (function walk(n) {
        n.children.forEach(function (c) {
          const has = cls.every((k) => c._class.split(/\s+/).indexOf(k) !== -1);
          if (has) out.push(c);
          walk(c);
        });
      })(node);
      return out;
    }
  };
  Object.defineProperty(node, "className", {
    get() { return node._class; },
    set(v) { node._class = v; }
  });
  Object.defineProperty(node, "textContent", {
    get() { return node._text; },
    set(v) { node._text = String(v); }
  });
  Object.defineProperty(node, "innerHTML", {
    set(v) { if (v === "") node.children = []; },
    get() { return node._text; }
  });
  Object.defineProperty(node, "classList", {
    get() {
      return {
        contains(c) { return node._class.split(/\s+/).indexOf(c) !== -1; },
        toggle(c, on) {
          const parts = node._class.split(/\s+/).filter(Boolean);
          const at = parts.indexOf(c);
          if (on && at === -1) parts.push(c);
          if (!on && at !== -1) parts.splice(at, 1);
          node._class = parts.join(" ");
        }
      };
    }
  });
  return node;
}

const appRoot = makeNode("main");
const handlers = {};
const sandbox = {
  document: {
    createElement: makeNode,
    getElementById: () => appRoot,
    addEventListener: (type, fn) => { handlers[type] = fn; }
  },
  /* main.js reads location for the optional seed; the shim has no URL. */
  location: { hash: "", search: "" },
  console: console
};
sandbox.window = sandbox;
vm.createContext(sandbox);

const files = fs
  .readFileSync(path.join(root, "index.html"), "utf8")
  .match(/<script src="([^"]+)"><\/script>/g)
  .map((s) => s.replace('<script src="', "").replace('"><\/script>', ""));

/* ---------- load the app in the same order index.html does ---------- */
const listeners = [];
files.forEach(function (src) {
  const code = fs.readFileSync(path.join(root, src), "utf8");
  if (/\bimport\b|\bexport\b/.test(code)) throw new Error("module syntax: " + src);
  vm.runInContext(code, sandbox, { filename: src });
});

/* ---------- drive real key events through main.js's listener ---------- */
let keyEvents = 0;
let acted = 0;
const ignoredCodes = [];
function press(event) {
  keyEvents += 1;
  let prevented = false;
  const evt = Object.assign({ preventDefault() { prevented = true; } }, event);
  handlers.keydown(evt);
  if (prevented) acted += 1; else ignoredCodes.push(event.code || event.key);
  return prevented;
}
const key = (ch) => press({ code: "Digit" + ch, key: ch });
const commit = () => press({ code: "Space", key: " " });
const backspace = () => press({ code: "Backspace", key: "Backspace" });

const state = sandbox.SOM.state;
/* Phase 2 step D: index.html no longer loads js/stubSpec.js; the harness
   generates its own spec from the real catalogue entry (seeded, so reruns of
   this file are reproducible). */
const spec = sandbox.SOM.generate(sandbox.SOM.config.entries[0], {
  rng: sandbox.SOM.random.seeded(20260815)
});
console.log("harness spec rows=" + JSON.stringify(spec.rows) + " cols=" + JSON.stringify(spec.cols));
const ROWS = spec.rows.length;

/* Always query live nodes: the grid is re-rendered partway through the run.
   DOM order is row-major; work order is column-major, so cells are placed into
   logical (work-order) positions via their data-row / data-col attributes. */
const liveCells = () => appRoot.querySelectorAll(".cell.answer");
const orderedCells = () => {
  const byIndex = new Array(liveCells().length);
  liveCells().forEach(function (c) {
    byIndex[Number(c.dataset.col) * ROWS + Number(c.dataset.row)] = c;
  });
  return byIndex;
};
const activeIndex = () => {
  const active = orderedCells().find((c) => c.classList.contains("is-active"));
  return active === undefined ? -1 : orderedCells().indexOf(active);
};
/* Null-safe: the Phase 3 reveal replaces #app, so HUD nodes can be gone. */
const progressText = () => {
  const el = appRoot.querySelector(".hud-progress");
  return el ? el._text : null;
};
const clockText = () => {
  const el = appRoot.querySelector(".hud-clock");
  return el ? el._text : null;
};
const texts = () => orderedCells().map((c) => c._text);

/* ---------- assertions ---------- */
let failures = [];
function check(label, actual, expected) {
  const ok = JSON.stringify(actual) === JSON.stringify(expected);
  if (!ok) failures.push(label + ": got " + JSON.stringify(actual));
  console.log((ok ? "PASS" : "FAIL") + "  " + label + "  actual=" + JSON.stringify(actual));
}

console.log("loaded files: " + files.join(", "));
console.log("cells rendered: " + liveCells().length);
console.log("\n-- start --");
check("cursor", state.info().cursor, 0);
check("active cell index", activeIndex(), 0);
check("progress", progressText(), "0/40");

console.log("\n-- clock: wired timer ticks down every second --");
const clock = sandbox.SOM.clock;
check("clock starts from the spec's seconds", clockText(), "5:00");
clock.tick(); /* the shim has no setInterval; tick() stands in for one second */
check("one tick shows 4:59", clockText(), "4:59");

console.log("\n-- type 19 then commit twice --");
["1", "9"].forEach(key);
check("text after typing 19", texts()[0], "19");
commit();
check("after commit 1: cursor", state.info().cursor, 1);
check("after commit 1: filled", state.info().filled, 1);
check("after commit 1: progress", progressText(), "1/40");
key("5");
commit();
check("after commit 2: cursor", state.info().cursor, 2);
check("after commit 2: filled", state.info().filled, 2);
check("after commit 2: progress", progressText(), "2/40");
check("after commit 2: active", activeIndex(), 2);

console.log("\n-- empty commit must not move or fill --");
commit(); /* cursor cell is empty here? it holds nothing after advance */
check("empty commit: cursor", state.info().cursor, 2);
check("empty commit: filled", state.info().filled, 2);

console.log("\n-- column-major walk to fill all cells --");
/* Continue down the first column from cursor 2. */
let expected = state.info().cursor;
const visitedOrder = [];
while (state.info().filled < 40) {
  const before = state.info().cursor;
  if (before !== expected) {
    failures.push("cursor out of work order: expected " + expected + " got " + before);
  }
  visitedOrder.push(before);
  key(String((before * 7) % 10)); /* distinct-ish values, never read as answers */
  commit();
  const info = state.info();
  /* Invariant: nothing past the cursor may hold text — no skipping. */
  const beyond = texts().filter((t, i) => i > info.cursor && t !== "").length;
  if (beyond > 0) {
    failures.push("cell beyond cursor held text at cursor " + info.cursor);
  }
  if (info.done) break;
  expected = info.cursor;
}
/* Independent column-major expectation: down each column, left to right. */
const expectedOrder = [];
for (let c = 0; c < 5; c += 1) {
  for (let r = 0; r < 8; r += 1) expectedOrder.push(c * 8 + r);
}
check(
  "visited order equals column-major",
  visitedOrder,
  expectedOrder.slice(visitedOrder[0], visitedOrder[0] + visitedOrder.length)
);
console.log("cells visited in walk: " + visitedOrder.length);
check("filled count at end", state.info().filled, 40);
/* Phase 3: completing the last cell submits and reveals immediately. */
check("submitted flag set on completion", state.info().submitted, true);
check("done flag", state.info().done, true);
/* The reveal replaces #app: HUD and drill grid are gone by construction. */
check("HUD replaced by result screen", clockText(), null);
const completedResult = state.info().result;
check("completion graded every cell", completedResult.results.length, 40);
check("completion correct count matches grade", completedResult.correct,
  completedResult.results.filter(Boolean).length);
check("completion score is correct + seconds left",
  completedResult.score, completedResult.correct + completedResult.secondsLeft);
/* All 40 cells were filled, so every graded cell shows its text (no em dash). */
check("non-empty cells", texts().filter((t) => t !== "").length, 40);
console.log("first 5 cell texts: " + JSON.stringify(texts().slice(0, 5)));
/* Graded cells: exactly one verdict class each. */
const graded = appRoot.querySelectorAll(".cell.answer");
check("graded cell count", graded.length, 40);
check("every graded cell has a verdict",
  graded.filter((c) => c.classList.contains("is-correct") ||
                       c.classList.contains("is-incorrect")).length, 40);
const scoreEl = appRoot.querySelector(".result-score");
check("score rendered in summary", scoreEl._text, "score " + completedResult.score);

console.log("\n-- entry stops when the grid is full --");
const lastBefore = texts()[39];
const activeBefore = activeIndex(); /* -1: no active cell on the result screen */
key("7");
commit();
check("after full: filled", state.info().filled, 40);
check("after full: last cell text unchanged", texts()[39], lastBefore);
check("after full: highlight unchanged", activeIndex(), activeBefore);

console.log("\n-- time-up after completion is a no-op (idempotent submit) --");
/* Tick the wired clock to zero; onExpire calls state.stop() again, which must
   not re-grade or re-render. No real waiting (no setInterval here). */
const resultBeforeExpiry = JSON.stringify(completedResult);
while (clock.secondsLeft() > 0) clock.tick();
check("timer stopped itself", clock.isRunning(), false);
check("result unchanged after expiry", JSON.stringify(state.info().result), resultBeforeExpiry);
key("9");
commit();
backspace();
check("keys after expiry fill nothing", state.info().filled, 40);
check("handle refuses after expiry", state.handle("digit", "1"), false);

console.log("\n-- timer unit checks (injectable, no waiting) --");
const ticks = [];
let expired = 0;
const t = sandbox.SOM.timer.createTimer({
  seconds: 2,
  onTick: function (left) { ticks.push(left); },
  onExpire: function () { expired += 1; }
});
t.tick(); /* never started: must not tick */
check("unstarted timer does not tick", ticks, []);
t.start();
t.tick();
t.tick();
check("ticks report seconds remaining", ticks, [1, 0]);
check("expired exactly at zero, once", expired, 1);
t.tick();
check("no ticks after expiry", ticks, [1, 0]);
t.start();
check("expired timer will not restart", t.isRunning(), false);

console.log("\n-- backspace: mid-cell removes one char --");
/* Restart the drill for a clean backspace test. No result view is wired here:
   finishing this session must end silently, not crash on a missing view. */
sandbox.SOM.drillView.render(appRoot, spec);
sandbox.SOM.entryView.setup(appRoot.querySelector(".drill-grid"));
sandbox.SOM.state.start(spec, {
  view: sandbox.SOM.entryView,
  hud: sandbox.SOM.drillHud.setup(
    appRoot.querySelector(".hud-progress"),
    appRoot.querySelector(".hud-clock")
  )
});
["1", "2", "3"].forEach(key);
check("three digits typed", texts()[0], "123");
backspace();
check("mid-cell backspace", texts()[0], "12");
check("cursor unchanged", state.info().cursor, 0);
check("filled unchanged", state.info().filled, 0);

console.log("\n-- backspace on empty cell at start does nothing --");
backspace();
backspace();
check("still at start", state.info().cursor, 0);
check("text empty", texts()[0], "");

console.log("\n-- fill forward, then step back once --");
["1", "2"].forEach(key);
commit(); /* fills index 0 with 12 */
key("9");
backspace(); /* mid-cell: 9 removed */
check("mid-cell removed", texts()[1], "");
backspace(); /* empty cell -> step back to index 0 */
check("stepped back once", state.info().cursor, 0);
check("previous value restored for editing", texts()[0], "12");
check("filled dropped", state.info().filled, 0);
check("progress after step back", progressText(), "0/40");
commit(); /* refill index 0 */
key("4");
commit();
check("forward again: cursor", state.info().cursor, 2);
/* Invariant: every cell strictly before the cursor is filled. Index 2 is the
   cursor itself, which is legitimately empty until something is typed. */
check("no blanks before cursor", texts().slice(0, 2), ["12", "4"]);
const ahead = texts().slice(2).filter((t) => t !== "").length;
check("cells beyond cursor untouched", ahead, 0);

console.log("\n-- ignored keys --");
press({ code: "KeyA", key: "a" });
press({ code: "Tab", key: "Tab" });
press({ code: "ArrowDown", key: "ArrowDown" });
check("ignored keys list", ignoredCodes.filter((c) => c !== "Space"), ["KeyA", "Tab", "ArrowDown"]);

console.log("\n-- totals --");
console.log("key events processed: " + keyEvents);
console.log("events acted on (preventDefault): " + acted);
console.log("ignored: " + ignoredCodes.length + " " + JSON.stringify(ignoredCodes));

console.log("\nRESULT: " + (failures.length === 0 ? "ALL CHECKS PASSED" : "FAILURES"));
failures.forEach((f) => console.log("  FAIL " + f));
process.exit(failures.length === 0 ? 0 : 1);
