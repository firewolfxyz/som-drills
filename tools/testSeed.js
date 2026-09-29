/* Phase 2 step D checks (no browser). Run: node tools/testSeed.js

   Loads js/random.js, js/walk.js, js/config.js and every file in
   js/generators/ into a sandbox TWICE - two separate module loads, so nothing
   carries over in memory between the runs it compares - then proves:

     1. parseSeed reads "seed=<int>" from URL-ish text and ignores junk.
     2. The seeded rng is deterministic for one seed and differs across seeds.
     3. Seeded generation is IDENTICAL across two fresh module loads for the
        real catalogue entry, and the grid has the right shape: row count,
        column count, exact digit counts, walk-consistent magnitudes, answers.
     4. js/ui/drillView.js renders negative rows with a visible minus sign
        (checked on generated text nodes, not assumed). */

const fs = require("fs");
const path = require("path");
const vm = require("vm");

const root = path.join(__dirname, "..");

function loadApp() {
  const sandbox = { console: console };
  sandbox.window = sandbox;
  vm.createContext(sandbox);
  const files = ["js/random.js", "js/walk.js", "js/config.js"]
    .concat(
      fs
        .readdirSync(path.join(root, "js", "generators"))
        .filter((f) => f.endsWith(".js"))
        .sort()
        .map((f) => "js/generators/" + f)
    );
  files.forEach(function (src) {
    const code = fs.readFileSync(path.join(root, src), "utf8");
    if (/\bimport\b|\bexport\b/.test(code)) throw new Error("module syntax: " + src);
    vm.runInContext(code, sandbox, { filename: src });
  });
  return sandbox;
}

let failures = 0;
function check(label, actual, expected) {
  const ok = JSON.stringify(actual) === JSON.stringify(expected);
  if (!ok) failures++;
  console.log((ok ? "PASS  " : "FAIL  ") + label + (ok ? "" : "  got " + JSON.stringify(actual)));
}

/* ---------- 1. seed parsing ---------- */
console.log("\n-- 1. parseSeed --");
const A = loadApp();
const SOM = A.SOM;
check("hash form", SOM.random.parseSeed("#seed=1234567890"), 1234567890);
check("query form", SOM.random.parseSeed("?seed=42"), 42);
check("among other params", SOM.random.parseSeed("#x=1&seed=7&y=2"), 7);
check("negative seed", SOM.random.parseSeed("#seed=-15"), -15);
check("no seed", SOM.random.parseSeed("#other=1"), null);
check("empty text", SOM.random.parseSeed(""), null);
check("truncated junk is not a seed", SOM.random.parseSeed("#seed=12x"), null);

/* ---------- 2. rng determinism ---------- */
console.log("\n-- 2. seeded rng --");
const draw = (seed) => [0, 1, 2, 3, 4].map(SOM.random.seeded(seed));
check("same seed, same stream", draw(1234567890), draw(1234567890));
check("different seed, different stream", draw(1) === draw(2), false);
check("values are in [0,1)", SOM.random.seeded(5)() < 1 && SOM.random.seeded(5)() >= 0, true);

/* ---------- 3. seeded generation across two fresh module loads ---------- */
console.log("\n-- 3. seeded generation, two independent loads --");
const entry = SOM.config.entries[0];
check("real catalogue entry is 2 x 1 addition", entry.name, "2 x 1 addition");

function generateSeeded(seed) {
  const sandbox = loadApp(); /* fresh modules: no shared state */
  return sandbox.SOM.generate(sandbox.SOM.config.entries[0], {
    rng: sandbox.SOM.random.seeded(seed)
  });
}
const runA = generateSeeded(1234567890);
const runB = generateSeeded(1234567890);
console.log("seed 1234567890 rows=" + JSON.stringify(runA.rows) + " cols=" + JSON.stringify(runA.cols));
check("rows identical across loads", runA.rows, runB.rows);
check("cols identical across loads", runA.cols, runB.cols);
check("answers identical across loads", runA.answers, runB.answers);

const other = generateSeeded(1234567891);
check("a different seed gives a different grid", runA.rows.join() === other.rows.join(), false);

/* Shape and digit counts for the real entry: 8 rows of exactly 2 digits,
   5 columns of exactly 1 digit, none negative, answers = row + col. */
check("row count", runA.rows.length, entry.rows.count);
check("column count", runA.cols.length, entry.columns.count);
check(
  "every row magnitude has exactly rows.digits digits",
  runA.rows.map((r) => String(Math.abs(r)).length),
  new Array(entry.rows.count).fill(entry.rows.digits)
);
check(
  "every column has exactly columns.digits digits",
  runA.cols.map((c) => String(c).length),
  new Array(entry.columns.count).fill(entry.columns.digits)
);
check("columns are never negative", runA.cols.every((c) => c > 0), true);
check(
  "row magnitudes follow the walk from row 1",
  runA.rows.map((r) => Math.abs(r)),
  [Math.abs(runA.rows[0])].concat(
    SOM.walk.rowSequence(Math.abs(runA.rows[0]), entry.rows.count - 1)
  )
);
check(
  "answers are row + column for every cell",
  runA.answers,
  runA.rows.map((r) => runA.cols.map((c) => r + c))
);
check("spec carries seconds from the entry", runA.seconds, entry.seconds);

/* ---------- 4. drillView renders negative rows with a minus sign ---------- */
console.log("\n-- 4. signed rows render with a minus sign (drillView) --");
const signedEntry = SOM.config.validate({
  name: "3 x 1 subtraction",
  operator: "subtract",
  rows: { count: 8, digits: 3, signed: true },
  columns: { count: 5, digits: 1 },
  seconds: 300,
  answer: "integer"
});
const signedSpec = SOM.generate(signedEntry, {
  start: 123,
  columns: [7, 6, 9, 8, 3],
  signs: [1, -1, 1, 1, -1, 1, -1, 1]
});
check("spec has negative rows to render", signedSpec.rows.filter((r) => r < 0).length, 3);

/* Minimal DOM shim: records textContent per node; drillView only creates,
   appends, and sets className/textContent. The UI module is loaded into this
   sandbox too, so the render is the real drillView code path. */
function makeNode(tag) {
  const node = { tag, children: [], className: "", dataset: {}, _text: "" };
  node.appendChild = (child) => node.children.push(child);
  Object.defineProperty(node, "textContent", {
    get() { return node._text; },
    set(v) { node._text = String(v); }
  });
  Object.defineProperty(node, "innerHTML", {
    set(v) { if (v === "") node.children = []; },
    get() { return node._text; }
  });
  return node;
}
const uiBox = { console: console, document: { createElement: makeNode } };
uiBox.window = uiBox;
vm.createContext(uiBox);
["js/ui/drillView.js"].forEach(function (src) {
  vm.runInContext(fs.readFileSync(path.join(root, src), "utf8"), uiBox, { filename: src });
});
const container = makeNode("main");
uiBox.window.SOM.drillView.render(container, signedSpec);
const grid = container.children[1]; /* children: HUD header, then the grid */
const rowheadTexts = grid.children.slice(1).map(function (row) {
  return row.children[0]._text; /* first cell of each data row is the rowhead */
});
check("grid has header row plus 8 data rows", grid.children.length, 9);
check(
  "rowhead text keeps the minus sign",
  rowheadTexts,
  ["123", "-496", "769", "332", "-605", "978", "-241", "514"]
);

console.log("\nRESULT: " + (failures === 0 ? "ALL CHECKS PASSED" : failures + " FAILURES"));
process.exit(failures === 0 ? 0 : 1);
