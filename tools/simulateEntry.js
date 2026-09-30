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
    /* Minimal style bag: the renderers set custom properties (--cols) for
       the row grid template; the shim records them without resolving CSS. */
    style: {
      _props: {},
      setProperty(name, value) { this._props[name] = String(value); },
      getProperty(name) { return this._props[name] || null; }
    },
    dataset: {},
    _attrs: {},
    children: [],
    _text: "",
    _listeners: {},
    setAttribute(name, value) { node._attrs[name] = String(value); },
    getAttribute(name) { return node._attrs[name] === undefined ? null : node._attrs[name]; },
    appendChild(child) { node.children.push(child); return child; },
    addEventListener(type, fn) { (node._listeners[type] = node._listeners[type] || []).push(fn); },
    click() {
      (node._listeners.click || []).forEach((fn) => fn());
    },
    querySelector(selector) { return node.querySelectorAll(selector)[0] || null; },
    querySelectorAll(selector) {
      /* Supports ".a.b" class chains and plain tag names ("button"). */
      const isTag = !selector.startsWith(".");
      const cls = isTag ? [] : selector.split(".").filter(Boolean);
      const out = [];
      (function walk(n) {
        n.children.forEach(function (c) {
          const has = (isTag ? c.tag === selector : true) &&
            cls.every((k) => c._class.split(/\s+/).indexOf(k) !== -1);
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
    /* Mirrors the real DOM: setting replaces children with text; getting
       concatenates this node's text with its descendants'. */
    get() { return node._text + node.children.map((c) => c.textContent).join(""); },
    set(v) { node._text = String(v); node.children = []; }
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
/* localStorage shim so the picker's persisted entry-mode choice works in
   node (the app treats a missing/throwing storage as "no saved mode"). */
const storageMap = {};
const sandbox = {
  localStorage: {
    getItem(k) { return Object.prototype.hasOwnProperty.call(storageMap, k) ? storageMap[k] : null; },
    setItem(k, v) { storageMap[k] = String(v); },
    removeItem(k) { delete storageMap[k]; }
  },
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

/* ---------- assertions ---------- */
let failures = [];
function check(label, actual, expected) {
  const ok = JSON.stringify(actual) === JSON.stringify(expected);
  if (!ok) failures.push(label + ": got " + JSON.stringify(actual));
  console.log((ok ? "PASS" : "FAIL") + "  " + label + "  actual=" + JSON.stringify(actual));
}

const state = sandbox.SOM.state;

/* ---------- Phase 4: the picker is the first screen ---------- */
console.log("\n-- picker screen --");
const pickerItems = appRoot.querySelectorAll(".picker-item");
check("picker lists every catalogue entry", pickerItems.length,
  sandbox.SOM.config.entries.length);
/* Items are grouped under per-operation headers, so DOM order is not
   catalogue order: sort by data-index before comparing names. */
check("picker item names match the catalogue",
  pickerItems
    .slice()
    .sort((a, b) => Number(a.dataset.index) - Number(b.dataset.index))
    .map((li) => li.querySelector(".picker-name")._text),
  sandbox.SOM.config.entries.map((e) => e.name));
check("picker has one header per operation",
  appRoot.querySelectorAll(".picker-group-title").length,
  new Set(sandbox.SOM.config.entries.map((e) => e.operator)).size);
/* Keys on the picker screen are refused: no session has started. */
key("5");
check("digit on picker starts no session", state.info().started, false);

/* Entry-mode toggle: cycles ltr -> rtl -> compute -> ltr, and persists the
   choice in localStorage. The rest of this harness runs a left-to-right
   session, so it ends back off. */
const dirToggle = appRoot.querySelector(".picker-direction");
check("picker has an entry-mode toggle", !!dirToggle, true);
check("entry mode defaults to left-to-right",
  [dirToggle._text, dirToggle.getAttribute("aria-pressed")],
  ["digits: left \u2192 right", "false"]);
dirToggle.click();
check("toggle switches to right-to-left",
  [dirToggle._text, dirToggle.getAttribute("aria-pressed")],
  ["digits: right \u2192 left", "true"]);
dirToggle.click();
check("toggle switches to compute order",
  [dirToggle._text, dirToggle.getAttribute("aria-pressed")],
  ["compute order", "true"]);
dirToggle.click();
check("toggle cycles back to left-to-right",
  [dirToggle._text, dirToggle.getAttribute("aria-pressed")],
  ["digits: left \u2192 right", "false"]);
check("mode choice persists in localStorage", storageMap["som-entry-mode"], "ltr");

/* Clicking an item starts that drill through main.js's wiring. */
pickerItems[0].querySelector("button").click();
check("picker click starts a session", state.info().started, true);

/* Right-to-left digit entry: each typed digit lands on the LEFT of what is
   already in the cell, so typing 1, 2, 3 yields "321". The grid work order
   (column-major, left to right) is unaffected. */
const rtlBox = { console: console, document: { createElement: makeNode } };
rtlBox.window = rtlBox;
vm.createContext(rtlBox);
["js/rules.js", "js/state.js", "js/ui/entryView.js"].forEach(function (src) {
  vm.runInContext(fs.readFileSync(path.join(root, src), "utf8"), rtlBox, { filename: src });
});
const rtlGrid = makeNode("div");
for (let r = 0; r < 2; r++) for (let c = 0; c < 3; c++) {
  const cell = makeNode("div");
  cell.className = "cell answer";
  cell.dataset.row = String(r);
  cell.dataset.col = String(c);
  rtlGrid.appendChild(cell);
}
rtlBox.SOM.entryView.setup(rtlGrid);
rtlBox.SOM.state.start({ rows: [1, 2], cols: [3, 4, 5] }, {
  view: rtlBox.SOM.entryView,
  hud: { setProgress() {}, setTimeFraction() {} }
}, { rtl: true });
["1", "2", "3"].forEach((d) => rtlBox.SOM.state.handle("digit", d));
check("rtl digits: typing 1,2,3 stores 321 in the cell",
  rtlGrid.children[0]._text, "321");
rtlBox.SOM.state.handle("back");
check("rtl digits: backspace removes the rightmost digit", rtlGrid.children[0]._text, "32");

/* Compute entry: digits are typed in mental-math order (right to left, final
   carry chunk last), displayed at their FINAL positions with a cursor marking
   where the next digit goes. On completion the cell shows the REAL answer and
   advances on its own; backspace undoes in typing order. */
const cBox = { console: console, document: { createElement: makeNode } };
cBox.window = cBox;
vm.createContext(cBox);
["js/rules.js", "js/state.js", "js/ui/entryView.js"].forEach(function (src) {
  vm.runInContext(fs.readFileSync(path.join(root, src), "utf8"), cBox, { filename: src });
});
const cGrid = makeNode("div");
for (let r = 0; r < 8; r++) for (let c = 0; c < 3; c++) {
  const cell = makeNode("div");
  cell.className = "cell answer";
  cell.dataset.row = String(r);
  cell.dataset.col = String(c);
  cGrid.appendChild(cell);
}
cBox.SOM.entryView.setup(cGrid);
/* Cells are appended row-major; work-order index i sits at row i%8, col
   floor(i/8), i.e. children[(i % 8) * 3 + floor(i / 8)]. */
const cCell = (i) => cGrid.children[(i % 8) * 3 + Math.floor(i / 8)];
/* 9 x 3 = 27 (type 7, then chunk 2); 15 x 3 = 45 (type 5, then chunk 4). */
cBox.SOM.state.start({
  operator: "multiply",
  rows: [9, 15],
  cols: [3, 4, 5],
  answers: [[27, 36, 45], [45, 60, 75]]
}, {
  view: cBox.SOM.entryView,
  hud: { setProgress() {}, setTimeFraction() {} }
}, { compute: true });
/* The cursor is a gold underline UNDER the next digit place: exactly one
   slot span per cell carries the .slot-next class. */
const cNext = (i) => cCell(i).children.findIndex(
  (c) => c._class.split(/\s+/).indexOf("slot-next") !== -1);
check("compute: empty cell marks its first-typed place (rightmost)",
  [cCell(0).textContent, cNext(0)], ["  ", 1]);
cBox.SOM.state.handle("digit", "7");
check("compute: first digit lands rightmost, cursor steps left",
  [cCell(0).textContent, cNext(0)], [" 7", 0]);
cBox.SOM.state.handle("digit", "2");
check("compute: complete buffer stores the REAL answer and auto-advances",
  [cCell(0).textContent, cBox.SOM.state.info().cursor], ["27", 1]);
check("compute: next cell starts fresh with its cursor",
  [cCell(1).textContent, cNext(1)], ["  ", 1]);
cBox.SOM.state.handle("digit", "5");
check("compute: second cell mid-entry", [cCell(1).textContent, cNext(1)], [" 5", 0]);
cBox.SOM.state.handle("back");
check("compute: backspace undoes the last-typed digit",
  [cCell(1).textContent, cBox.SOM.state.info().cursor], ["  ", 1]);
/* Step back into a completed cell: its full typed buffer is restored, shown
   as the real answer; one more backspace opens it for editing. */
cBox.SOM.state.handle("back");
check("compute: stepping back restores the completed cell",
  cCell(0).textContent, "27");
cBox.SOM.state.handle("back");
check("compute: backspace reopens it mid-entry with the cursor",
  [cCell(0).textContent, cNext(0)], [" 7", 0]);
cBox.SOM.state.handle("digit", "2");
check("compute: retyping the chunk completes it again",
  [cCell(0)._text, cBox.SOM.state.info().cursor], ["27", 1]);

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

console.log("loaded files: " + files.join(", "));
console.log("cells rendered: " + liveCells().length);
console.log("\n-- start --");
check("cursor", state.info().cursor, 0);
check("active cell index", activeIndex(), 0);
check("progress", progressText(), "0/40");

console.log("\n-- time is hidden during the drill; timer still ticks --");
const clock = sandbox.SOM.clock;
check("no clock element in the HUD", clockText(), null);
clock.tick(); /* the shim has no setInterval; tick() stands in for one second */
check("timer counts down internally", clock.secondsLeft(), 299);

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
check("HUD replaced by result screen", progressText(), null);
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
check("score not displayed (known at grade time)",
  appRoot.querySelector(".result-score"), null);

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
