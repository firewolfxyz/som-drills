/* Unit tests for rules.summarize (docs/phases.md Phase 4 session summary).
   Run with: node tools/testSummarize.js */

const path = require("path");
const fs = require("fs");
const vm = require("vm");

const root = path.join(__dirname, "..");
const sandbox = { window: {}, document: { createElement() { return {}; } } };
sandbox.window = sandbox;
vm.createContext(sandbox);
for (const src of ["js/rules.js"]) {
  vm.runInContext(fs.readFileSync(path.join(root, src), "utf8"), sandbox, { filename: src });
}

let failures = 0;
function check(label, actual, expected) {
  const ok = JSON.stringify(actual) === JSON.stringify(expected);
  if (!ok) {
    failures += 1;
    console.log("FAIL " + label + "\n  got      " + JSON.stringify(actual) +
                "\n  expected " + JSON.stringify(expected));
  } else {
    console.log("PASS " + label);
  }
}

/* A 3-row x 4-col grid. Work order is column-major: index = col*3 + row, so
   index % 3 is the row and floor(index / 3) is the column. */
const spec = {
  name: "test",
  rows: [10, 20, 30],
  cols: [1, 2, 3, 4],
  seconds: 100,
  answers: [
    ["11", "12", "13", "14"],
    ["21", "22", "23", "24"],
    ["31", "32", "33", "34"]
  ]
};
/* spec.answers is indexed [row][col]; work order is index = col*3 + row. */
const answerAt = (index) => String(spec.answers[index % 3][Math.floor(index / 3)]);

/* texts in work order: 10 correct, one wrong answer (index 5), one empty
   cell (index 9). Array.from builds a DENSE array — new Array(12).map() would
   be sparse (.map skips holes) and every index would read as a hole. */
const texts = Array.from({ length: 12 }, (_, i) => answerAt(i));
texts[5] = "99";
texts[9] = "";

/* Derive the expected verdicts from the same exact-match rule grade uses, so
   this fixture cannot drift from the rules it tests. */
const results = texts.map((t, i) => t === answerAt(i));
const expectedMissed = [];
results.forEach((ok, i) => { if (!ok) expectedMissed.push(i); });
const expectedColumns = spec.cols.map((_, col) => ({
  correct: results.slice(col * 3, col * 3 + 3).filter(Boolean).length,
  total: 3
}));

/* Case 1: mixed accuracy. */
const s1 = sandbox.SOM.rules.summarize(spec, texts, results, 11, 40);
check("per-column accuracy", s1.columns, expectedColumns);
check("expected missed set is what the fixture intends", expectedMissed, [5, 9]);
check("missed cells are the wrong/empty work-order indices", s1.missed, expectedMissed);
check("pace is elapsed seconds per filled cell", s1.pace, 60 / 11);
check("filled is carried through", s1.filled, 11);

/* Case 2: all correct — nothing missed. */
const allTexts = Array.from({ length: 12 }, (_, i) => answerAt(i));
const allResults = new Array(12).fill(true);
const s2 = sandbox.SOM.rules.summarize(spec, allTexts, allResults, 12, 0);
check("all correct: no missed cells", s2.missed, []);
check("all correct: every column full", s2.columns, [
  { correct: 3, total: 3 },
  { correct: 3, total: 3 },
  { correct: 3, total: 3 },
  { correct: 3, total: 3 }
]);
check("time-up pace uses full elapsed time", s2.pace, 100 / 12);

/* Case 3: nothing filled — pace is null, never a division by zero. */
const emptyTexts = new Array(12).fill("");
const emptyResults = new Array(12).fill(false);
const s3 = sandbox.SOM.rules.summarize(spec, emptyTexts, emptyResults, 0, 100);
check("nothing filled: pace is null", s3.pace, null);
check("nothing filled: every cell missed", s3.missed.length, 12);
check("nothing filled: columns all zero", s3.columns[0], { correct: 0, total: 3 });

/* Case 4: summarize agrees with grade on the same inputs. */
const graded = sandbox.SOM.rules.grade(spec, texts, 40);
check("summarize uses grade's per-cell verdicts",
  s1.missed.length, 12 - graded.correct);

console.log(failures === 0 ? "\nALL PASS" : "\n" + failures + " FAILURE(S)");
process.exit(failures === 0 ? 0 : 1);
