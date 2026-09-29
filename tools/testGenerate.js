/* Pure-logic test for js/generators/ (no DOM). Run: node tools/testGenerate.js

   Loads the REAL modules (js/walk.js, js/config.js and every file in
   js/generators/) into one sandbox exactly as index.html would load them, then
   checks generation against the reference grids in docs/generation.md.

   Coverage:
     1. `2 x 1 addition` reference grid straight from the real catalogue entry.
     2. `3 x 1 multiplication` reference grid (entry authored in-test).
     3. Division notation: "17r4" style, and zero remainder as "62", never "62r0".
     4. Signed rows: magnitudes still follow the walk; answers use signed values.
     5. Random mode with a seeded rng: digit counts, determinism, rng sensitivity.
     6. Invariant violations must throw loudly, not produce a bad grid. */

const fs = require("fs");
const path = require("path");
const vm = require("vm");

const root = path.join(__dirname, "..");

/* ---------- load the real files in dependency order ---------- */
function loadFiles(list) {
  const sandbox = { console: console };
  sandbox.window = sandbox;
  vm.createContext(sandbox);
  list.forEach(function (src) {
    const code = fs.readFileSync(path.join(root, src), "utf8");
    if (/\bimport\b|\bexport\b/.test(code)) throw new Error("module syntax: " + src);
    vm.runInContext(code, sandbox, { filename: src });
  });
  return sandbox;
}

const generatorFiles = fs
  .readdirSync(path.join(root, "js", "generators"))
  .filter((f) => f.endsWith(".js"))
  .sort()
  .map((f) => "js/generators/" + f);

console.log("loaded: js/walk.js, js/config.js, " + generatorFiles.join(", "));

const sandbox = loadFiles(["js/walk.js", "js/config.js"].concat(generatorFiles));
const SOM = sandbox.SOM;
const generate = SOM.generate;

let failures = 0;
function check(label, actual, expected) {
  const ok = JSON.stringify(actual) === JSON.stringify(expected);
  if (!ok) failures++;
  console.log((ok ? "PASS  " : "FAIL  ") + label + (ok ? "" : "  got " + JSON.stringify(actual)));
}
function expectThrow(label, fn) {
  try {
    const value = fn();
    failures++;
    console.log("FAIL  " + label + "  (no throw, got " + JSON.stringify(value) + ")");
  } catch (err) {
    console.log("PASS  " + label + "  throws: " + err.message);
  }
}

/* ---------- 1. reference grid: `2 x 1 addition` from the real catalogue ---- */
console.log("\n-- 1. reference grid 2 x 1 addition (real config entry) --");
const addEntry = SOM.config.entries.filter((e) => e.name === "2 x 1 addition")[0];
check("catalogue has 2 x 1 addition", !!addEntry, true);

const ADD_GRID = {
  rows: [12, 49, 76, 33, 60, 97, 24, 51],
  cols: [7, 5, 9, 4, 6],
  answers: [
    [19, 17, 21, 16, 18],
    [56, 54, 58, 53, 55],
    [83, 81, 85, 80, 82],
    [40, 38, 42, 37, 39],
    [67, 65, 69, 64, 66],
    [104, 102, 106, 101, 103],
    [31, 29, 33, 28, 30],
    [58, 56, 60, 55, 57]
  ]
};
const addSpec = generate(addEntry, { start: 12, columns: ADD_GRID.cols });
check("add name", addSpec.name, "2 x 1 addition");
check("add operator", addSpec.operator, "add");
check("add answerFormat comes from entry.answer", addSpec.answerFormat, "integer");
check("add rows exactly", addSpec.rows, ADD_GRID.rows);
check("add cols exactly", addSpec.cols, ADD_GRID.cols);
check("add row count", addSpec.rows.length, 8);
check("add answers: all 40 cells match the doc grid", addSpec.answers, ADD_GRID.answers);
check(
  "add cell count",
  addSpec.answers.reduce((n, r) => n + r.length, 0),
  40
);

/* ---------- 2. reference grid: `3 x 1 multiplication` ---------- */
console.log("\n-- 2. reference grid 3 x 1 multiplication (entry authored in-test) --");
const mulEntry = SOM.config.validate({
  name: "3 x 1 multiplication",
  operator: "multiply",
  rows: { count: 8, digits: 3, signed: false },
  columns: { count: 5, digits: 1 },
  seconds: 300,
  answer: "integer"
});
check("multiplication entry validates", !!mulEntry, true);

const MUL_GRID = {
  rows: [123, 496, 769, 332, 605, 978, 241, 514],
  cols: [7, 6, 9, 8, 3],
  answers: [
    [861, 738, 1107, 984, 369],
    [3472, 2976, 4464, 3968, 1488],
    [5383, 4614, 6921, 6152, 2307],
    [2324, 1992, 2988, 2656, 996],
    [4235, 3630, 5445, 4840, 1815],
    [6846, 5868, 8802, 7824, 2934],
    [1687, 1446, 2169, 1928, 723],
    [3598, 3084, 4626, 4112, 1542]
  ]
};
const mulSpec = generate(mulEntry, { start: 123, columns: MUL_GRID.cols });
check("multiply rows exactly", mulSpec.rows, MUL_GRID.rows);
check("multiply answers: all 40 cells match the doc grid", mulSpec.answers, MUL_GRID.answers);

/* ---------- 3. division notation, including zero remainder ---------- */
console.log("\n-- 3. division: quotient r remainder, zero remainder quotient-only --");
const divEntry = SOM.config.validate({
  name: "3 x 1 division",
  operator: "divide",
  rows: { count: 8, digits: 3, signed: false },
  columns: { count: 5, digits: 1 },
  seconds: 300,
  answer: "quotientRemainder"
});
const divSpec = generate(divEntry, { start: 123, columns: [7, 6, 9, 8, 3] });
check("division first two rows are 123, 496", divSpec.rows.slice(0, 2), [123, 496]);
check("division answerFormat", divSpec.answerFormat, "quotientRemainder");
check("123 row matches the doc", divSpec.answers[0], ["17r4", "20r3", "13r6", "15r3", "41"]);
check("496 row matches the doc", divSpec.answers[1], ["70r6", "82r4", "55r1", "62", "165r1"]);
check("zero remainder is \"62\", never \"62r0\"", divSpec.answers[1][3], "62");
check("no answer contains a trailing r0", /r0$/.test(divSpec.answers.join("|")), false);
check("division rows are all positive", divSpec.rows.every((r) => r > 0), true);

/* ---------- 4. signed rows ---------- */
console.log("\n-- 4. signed rows: walk magnitudes unchanged, answers signed --");
const signedMulEntry = SOM.config.validate({
  name: "3 x 1 signed multiplication",
  operator: "multiply",
  rows: { count: 8, digits: 3, signed: true },
  columns: { count: 5, digits: 1 },
  seconds: 300,
  answer: "integer"
});
const signs = [1, -1, 1, 1, -1, 1, -1, 1];
const signedMul = generate(signedMulEntry, { start: 123, columns: [7, 6, 9, 8, 3], signs: signs });
check("signed rows follow the walk magnitudes with signs applied", signedMul.rows, [
  123, -496, 769, 332, -605, 978, -241, 514
]);
check(
  "magnitudes are exactly the unsigned walk",
  signedMul.rows.map((r) => Math.abs(r)),
  MUL_GRID.rows
);
check("signed multiply row 2 uses the negative value", signedMul.answers[1], [-3472, -2976, -4464, -3968, -1488]);
check("unsigned multiply row 1 is unchanged", signedMul.answers[0], MUL_GRID.answers[0]);

const signedSubEntry = SOM.config.validate({
  name: "3 x 1 signed subtraction",
  operator: "subtract",
  rows: { count: 8, digits: 3, signed: true },
  columns: { count: 5, digits: 1 },
  seconds: 300,
  answer: "integer"
});
const signedSub = generate(signedSubEntry, { start: 123, columns: [7, 6, 9, 8, 3], signs: signs });
check("signed subtract row 1", signedSub.answers[0], [116, 117, 114, 115, 120]);
check("signed subtract row 2 (-496)", signedSub.answers[1], [-503, -502, -505, -504, -499]);

/* Random signs: omitted opts.signs on a signed drill must still keep magnitudes
   on the walk and stay within {+1,-1}. */
const randomSignSpec = generate(signedSubEntry, { start: 123, columns: [7, 6, 9, 8, 3], rng: seeded(7) });
check("random-sign rows keep walk magnitudes", randomSignSpec.rows.map((r) => Math.abs(r)), MUL_GRID.rows);
check("random signs are +/-1 only", randomSignSpec.rows.every((r) => Math.sign(r) === 1 || Math.sign(r) === -1), true);

/* ---------- 5. random mode with a seeded rng ---------- */
console.log("\n-- 5. random mode: digit counts, determinism, rng sensitivity --");
function seeded(seed) {
  let state = seed >>> 0;
  return function () {
    state = (state * 1664525 + 1013904223) >>> 0;
    return state / 4294967296;
  };
}
const randCols1 = generate(addEntry, { start: 12, rng: seeded(42) }).cols;
const randCols2 = generate(addEntry, { start: 12, rng: seeded(42) });
const randCols3 = generate(addEntry, { start: 12, rng: seeded(43) });
check("random columns honour columns.count", randCols1.length, 5);
check("random columns have exactly 1 digit", randCols1.map((c) => String(c).length), [1, 1, 1, 1, 1]);
check("random columns are never negative", randCols1.every((c) => c > 0), true);
check("same seed is deterministic", randCols2.cols, randCols1);
check("same seed reproduces the whole spec", randCols2.answers, generate(addEntry, { start: 12, rng: seeded(42) }).answers);
check("different seed gives different columns", randCols3.cols === randCols1, false);

/* Two-digit column headers: exactly 2 digits, nonzero leading digit. */
const addEntry2 = SOM.config.validate({
  name: "2 x 2 addition",
  operator: "add",
  rows: { count: 8, digits: 2, signed: false },
  columns: { count: 5, digits: 2 },
  seconds: 300,
  answer: "integer"
});
const twoDigitCols = [];
for (let seed = 0; seed < 200; seed++) {
  const spec = generate(addEntry2, { start: 12, rng: seeded(seed) });
  spec.cols.forEach((c) => twoDigitCols.push(String(c).length));
}
check("200 seeded runs all give exactly 2-digit columns", twoDigitCols.every((n) => n === 2), true);

/* Random start omitted entirely: row magnitudes keep rows.digits. */
const startDigits = [];
for (let seed = 0; seed < 200; seed++) {
  const spec = generate(mulEntry, { rng: seeded(seed + 1000) });
  spec.rows.forEach((r) => startDigits.push(String(r).length));
}
check("200 seeded runs all give exactly 3-digit rows", startDigits.every((n) => n === 3), true);
check(
  "random-start spec is deterministic for a seed",
  generate(mulEntry, { rng: seeded(5) }).rows,
  generate(mulEntry, { rng: seeded(5) }).rows
);

/* ---------- 6. invariants throw loudly ---------- */
console.log("\n-- 6. generation-time invariants --");
expectThrow("start with too few digits", () => generate(addEntry, { start: 5, columns: [7, 5, 9, 4, 6] }));
expectThrow("start with too many digits", () => generate(mulEntry, { start: 1234, columns: [7, 6, 9, 8, 3] }));
expectThrow("negative start", () => generate(addEntry, { start: -12, columns: [7, 5, 9, 4, 6] }));
expectThrow("column with wrong digit count", () => generate(addEntry, { start: 12, columns: [7, 5, 9, 4, 10] }));
expectThrow("too few columns", () => generate(addEntry, { start: 12, columns: [7, 5, 9, 4] }));
expectThrow("negative column", () => generate(addEntry, { start: 12, columns: [7, -5, 9, 4, 6] }));
expectThrow("sign that is not +/-1", () =>
  generate(signedMulEntry, { start: 123, columns: [7, 6, 9, 8, 3], signs: [1, 0, 1, 1, -1, 1, -1, 1] })
);
expectThrow("signs for an unsigned drill", () =>
  generate(addEntry, { start: 12, columns: [7, 5, 9, 4, 6], signs: [1, 1, 1, 1, 1, 1, 1, 1] })
);
expectThrow("unregistered operator", () =>
  generate(
    { name: "2 x 1 modulo", operator: "modulo", rows: { count: 8, digits: 2, signed: false }, columns: { count: 5, digits: 1 } },
    { start: 12 }
  )
);
expectThrow("divide refuses a negative row", () => SOM.generators.divide(-123, 7));

console.log("\nRESULT: " + (failures === 0 ? "ALL CHECKS PASSED" : failures + " FAILURES"));
process.exit(failures === 0 ? 0 : 1);
