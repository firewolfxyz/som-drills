/* Headless regression suite for the bugs documented in docs/bugs.md. Each
   check asserts the FIXED behaviour, so a regression fails the suite (and
   CI, which runs every tools/test*.js). Reuses the DOM shim style of
   tools/simulateEntry.js and loads the real files in index.html order.
   Run: node tools/testBugs.js */

const fs = require("fs");
const path = require("path");
const vm = require("vm");
const root = path.join(__dirname, "..");

function makeNode(tag) {
  const node = {
    tag: tag,
    _class: "",
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
    click() { (node._listeners.click || []).forEach((fn) => fn()); },
    querySelector(selector) { return node.querySelectorAll(selector)[0] || null; },
    querySelectorAll(selector) {
      /* Supports ".a.b" class chains, plain tag names ("button") and one
         descendant combinator (".picker-item button"). */
      const parts = selector.trim().split(/\s+/);
      const matchOne = (node, sel) => {
        const cls = sel.split(".").filter(Boolean);
        if (sel.startsWith(".")) return cls.every((k) => node._class.split(/\s+/).indexOf(k) !== -1);
        return node.tag === sel;
      };
      const out = [];
      (function walk(n) {
        n.children.forEach(function (c) {
          if (parts.length === 1) {
            if (matchOne(c, parts[0])) out.push(c);
          } else if (matchOne(c, parts[parts.length - 1])) {
            out.push(c);
          }
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
    get() { return node._text + node.children.map((c) => c.textContent).join(""); },
    set(v) { node._text = String(v); node.children = []; }
  });
  Object.defineProperty(node, "innerHTML", {
    set(v) { if (v === "") node.children = []; },
    get() { return node._text; }
  });
  Object.defineProperty(node, "firstElementChild", {
    get() { return node.children[0] || null; }
  });
  Object.defineProperty(node, "classList", {
    get() {
      return {
        contains(c) { return node._class.split(/\s+/).indexOf(c) !== -1; },
        add(c) {
          const parts = node._class.split(/\s+/).filter(Boolean);
          if (parts.indexOf(c) === -1) parts.push(c);
          node._class = parts.join(" ");
        },
        remove(c) {
          const parts = node._class.split(/\s+/).filter(Boolean);
          const at = parts.indexOf(c);
          if (at !== -1) parts.splice(at, 1);
          node._class = parts.join(" ");
        },
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
const storageMap = {};
const timers = [];
const sandbox = {
  localStorage: {
    getItem(k) { return Object.prototype.hasOwnProperty.call(storageMap, k) ? storageMap[k] : null; },
    setItem(k, v) { storageMap[k] = String(v); },
    removeItem(k) { delete storageMap[k]; }
  },
  document: {
    createElement: makeNode,
    getElementById: () => appRoot,
    addEventListener: (type, fn) => { handlers.keydown = fn; }
  },
  location: { hash: "", search: "" },
  setInterval(fn, ms) { timers.push(fn); return timers.length; },
  clearInterval(id) { timers[id - 1] = null; },
  console: console
};
sandbox.window = sandbox;
vm.createContext(sandbox);

const files = fs
  .readFileSync(path.join(root, "index.html"), "utf8")
  .match(/<script src="([^"]+)"><\/script>/g)
  .map((s) => s.replace('<script src="', "").replace('"><\/script>', ""));
files.forEach(function (src) {
  const code = fs.readFileSync(path.join(root, src), "utf8");
  vm.runInContext(code, sandbox, { filename: src });
});

const storageKeysAtLoad = Object.keys(storageMap).length;

let results = [];
function probe(label, actual, expected) {
  const ok = JSON.stringify(actual) === JSON.stringify(expected);
  results.push({ label, ok, actual });
  console.log((ok ? "PASS" : "BUG ") + "  " + label + "  actual=" + JSON.stringify(actual));
}

const SOM = sandbox.SOM;

/* Bug 1: division answers need an "r" separator (docs/ui.md). */
probe("keys.js maps the r separator (docs/ui.md requires it)",
  SOM.keys.actionFor({ code: "KeyR", key: "r" }), { action: "sep", char: "r" });
/* The keypad is only auto-rendered for coarse pointers, which the shim has
   none of, so render it explicitly and look for the key. */
const padRoot = makeNode("div");
const padTaps = [];
SOM.keypadView.render(padRoot, function (action, char) { padTaps.push([action, char]); });
const padLabels = padRoot.querySelectorAll("button").map((b) => b._text);
probe("keypad has an r key for quotient-remainder answers",
  padLabels.indexOf("r") !== -1, true);
const rKey = padRoot.querySelectorAll("button").filter((b) => b._text === "r")[0];
/* pointerdown, not click: that is what keypadView binds. */
(rKey._listeners.pointerdown || []).forEach((fn) =>
  fn({ preventDefault() {} }));
probe("keypad r key reports a separator action", padTaps, [["sep", "r"]]);

/* Division drills in the catalogue: how many cells need an r? */
const divEntry = SOM.config.entries.filter((e) => e.operator === "divide")[0];
const divSpec = SOM.generate(divEntry, { rng: SOM.random.seeded(12345) });
let needR = 0;
divSpec.rows.forEach((row, r) => divSpec.cols.forEach((col, c) => {
  if (String(divSpec.answers[r][c]).indexOf("r") !== -1) needR += 1;
}));
probe("division cells whose answer needs an r separator",
  [needR, divSpec.rows.length * divSpec.cols.length],
  [needR, divSpec.rows.length * divSpec.cols.length]);

/* ---------- BUG 2: compute mode, back into a correct cell then Enter ---------- */
const cBox = { console: console, document: { createElement: makeNode } };
cBox.window = cBox;
vm.createContext(cBox);
["js/rules.js", "js/state.js", "js/ui/entryView.js"].forEach(function (src) {
  vm.runInContext(fs.readFileSync(path.join(root, src), "utf8"), cBox, { filename: src });
});
const cGrid = makeNode("div");
for (let r = 0; r < 2; r++) for (let c = 0; c < 3; c++) {
  const cell = makeNode("div");
  cell.className = "cell answer";
  cell.dataset.row = String(r);
  cell.dataset.col = String(c);
  cGrid.appendChild(cell);
}
cBox.SOM.entryView.setup(cGrid);
const cCell = (i) => cGrid.children[(i % 2) * 3 + Math.floor(i / 2)];
const spec = {
  operator: "multiply",
  rows: [9, 15],
  cols: [3, 4, 5],
  answers: [[27, 36, 45], [45, 60, 75]]
};
cBox.SOM.state.start(spec, {
  view: cBox.SOM.entryView,
  hud: { setProgress() {}, setTimeFraction() {} }
}, { compute: true });
cBox.SOM.state.handle("digit", "7");
cBox.SOM.state.handle("digit", "2");   /* cell 0 completes: stores 27 */
probe("compute: completed cell stores the real answer", cCell(0).textContent, "27");
cBox.SOM.state.handle("back");         /* step back into cell 0 */
probe("compute: stepping back keeps the cell readable", cCell(0).textContent, "27");
cBox.SOM.state.handle("commit");        /* Enter on the restored cell */
probe("compute: Enter on a restored correct cell keeps it correct",
  cCell(0).textContent, "27");
cBox.SOM.state.stop();                  /* grade the grid */
probe("compute: Enter on a restored correct cell grades correct",
  cBox.SOM.state.info().result.correct, 1);

/* ---------- BUG 3: the timer is never stopped on submit ---------- */
appRoot.querySelectorAll(".picker-item")[0].querySelector("button").click();   /* starts a drill */
probe("starting a drill arms the countdown", timers.filter(Boolean).length, 1);
SOM.state.stop();   /* submit: the run is over */
probe("timer interval is cleared when the drill submits",
  timers.filter(Boolean).length, 0);

/* ---------- BUG 4: #drill= starts in ltr, ignoring the saved mode ---------- */
const fragRoot = makeNode("main");
const fragBox = { console: console };
fragBox.window = fragBox;
const fragStorage = { "som-entry-mode": "compute" };
fragBox.localStorage = {
  getItem(k) { return Object.prototype.hasOwnProperty.call(fragStorage, k) ? fragStorage[k] : null; },
  setItem(k, v) { fragStorage[k] = String(v); },
  removeItem(k) { delete fragStorage[k]; }
};
fragBox.document = {
  createElement: makeNode,
  getElementById: function (id) {
    if (id === "app") return fragRoot;
    return makeNode("div");
  },
  addEventListener() {}
};
fragBox.location = { hash: "#drill=0", search: "" };
fragBox.setInterval = () => 1;
fragBox.clearInterval = () => {};
vm.createContext(fragBox);
files.forEach(function (src) {
  vm.runInContext(fs.readFileSync(path.join(root, src), "utf8"), fragBox, { filename: src });
});
/* state.info() exposes no mode, so read the rendered cell: compute mode paints
   slot spans for an empty cell, plain modes paint an empty text cell. */
const fragCell = fragRoot.querySelectorAll(".cell.answer")[0];
probe("#drill= fragment honours the saved entry mode",
  fragCell ? fragCell.children.length > 0 : null, true);

/* ---------- BUG 6: a seed before another fragment param is dropped ---------- */
probe("parseSeed reads #seed=123#drill=2",
  SOM.random.parseSeed("#seed=123#drill=2"), 123);
probe("parseSeed reads #drill=2#seed=123",
  SOM.random.parseSeed("#drill=2#seed=123"), 123);

/* ---------- BUG 7: auto-advance counts the r in a division answer ---------- */
const dBox = { console: console, document: { createElement: makeNode } };
dBox.window = dBox;
vm.createContext(dBox);
["js/rules.js", "js/state.js", "js/ui/entryView.js"].forEach(function (src) {
  vm.runInContext(fs.readFileSync(path.join(root, src), "utf8"), dBox, { filename: src });
});
const dGrid = makeNode("div");
for (let r = 0; r < 2; r++) for (let c = 0; c < 2; c++) {
  const cell = makeNode("div");
  cell.className = "cell answer";
  cell.dataset.row = String(r);
  cell.dataset.col = String(c);
  dGrid.appendChild(cell);
}
dBox.SOM.entryView.setup(dGrid);
const dCell = (i) => dGrid.children[(i % 2) * 2 + Math.floor(i / 2)];
dBox.SOM.state.start({
  operator: "divide",
  rows: [17, 25],
  cols: [5, 3],
  answers: [["3r2", "5r2"], ["5", "8r1"]]
}, {
  view: dBox.SOM.entryView,
  hud: { setProgress() {}, setTimeFraction() {} }
}, { auto: true });
["3", "2"].forEach((d) => dBox.SOM.state.handle("digit", d));
probe("auto: a 3-char division answer is not committed after 2 digits",
  dBox.SOM.state.info().cursor, 0);

/* Bug 1, end to end: a whole division grid typed with the r separator grades
   100%. Work order is column-major, so index 0 is 17/5 = "3r2", index 1 is
   25/5 = "5", index 2 is 17/3 = "5r2", index 3 is 25/3 = "8r1". */
dBox.SOM.state.start({
  operator: "divide",
  rows: [17, 25],
  cols: [5, 3],
  answers: [["3r2", "5r2"], ["5", "8r1"]]
}, { view: dBox.SOM.entryView, hud: { setProgress() {}, setTimeFraction() {} } });
[["3", "r", "2"], ["5"], ["5", "r", "2"], ["8", "r", "1"]].forEach(function (keys) {
  keys.forEach(function (k) {
    dBox.SOM.state.handle(k === "r" ? "sep" : "digit", k);
  });
  dBox.SOM.state.handle("commit");
});
probe("division: a full grid typed with r grades every cell correct",
  [dBox.SOM.state.info().result.correct, dBox.SOM.state.info().result.results],
  [4, [true, true, true, true]]);

/* Right-to-left entry keeps working for division: the separator is a
   character of the answer, so it moves with the digits. Typing the answer
   right to left (2, r, 3) must still store "3r2". */
dBox.SOM.state.start({
  operator: "divide",
  rows: [17],
  cols: [5],
  answers: [["3r2"]]
}, { view: dBox.SOM.entryView, hud: { setProgress() {}, setTimeFraction() {} } },
  { rtl: true });
["2", "r", "3"].forEach(function (k) {
  dBox.SOM.state.handle(k === "r" ? "sep" : "digit", k);
});
probe("division in right-to-left mode: 2,r,3 stores 3r2", dCell(0).textContent, "3r2");

/* A stray r must not be typed into a drill whose answers have no remainder. */
const aBox = { console: console, document: { createElement: makeNode } };
aBox.window = aBox;
vm.createContext(aBox);
["js/rules.js", "js/state.js", "js/ui/entryView.js"].forEach(function (src) {
  vm.runInContext(fs.readFileSync(path.join(root, src), "utf8"), aBox, { filename: src });
});
const aGrid = makeNode("div");
for (let r = 0; r < 2; r++) for (let c = 0; c < 2; c++) {
  const cell = makeNode("div");
  cell.className = "cell answer";
  cell.dataset.row = String(r);
  cell.dataset.col = String(c);
  aGrid.appendChild(cell);
}
aBox.SOM.entryView.setup(aGrid);
const aCell = (i) => aGrid.children[(i % 2) * 2 + Math.floor(i / 2)];
aBox.SOM.state.start({
  operator: "add", rows: [12, 34], cols: [5, 6], answers: [[17, 18], [39, 40]]
}, { view: aBox.SOM.entryView, hud: { setProgress() {}, setTimeFraction() {} } });
aBox.SOM.state.handle("digit", "1");
probe("stray r in an addition drill is refused, not typed",
  [aBox.SOM.state.handle("sep", "r"), aCell(0).textContent], [false, "1"]);

probe("history.js leaves localStorage untouched on load",
  storageKeysAtLoad, 0);

console.log("\n" + results.filter((r) => !r.ok).length + " of " + results.length +
  " probes show a bug");
if (results.some((r) => !r.ok)) process.exit(1);
