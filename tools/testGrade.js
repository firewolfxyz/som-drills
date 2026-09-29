/* Phase 3 checks for rules.grade (no browser). Run: node tools/testGrade.js

   Loads js/rules.js into a sandbox and proves:

     1. Every cell is graded in one pass; results are indexed by work order
        (index = col * rowCount + row), so a known answer at a known
        row/column lands on the expected index.
     2. A cell is correct iff its text equals the expected answer EXACTLY —
        "07" does not grade as "7", and division form "3r2" is compared as a
        string (no numeric re-parsing can accept a wrong form).
     3. Empty / null entries grade as incorrect.
     4. score = correct cells + seconds remaining (phases.md Phase 3). */

const fs = require("fs");
const path = require("path");
const vm = require("vm");

const root = path.join(__dirname, "..");
const sandbox = {};
sandbox.window = sandbox;
vm.createContext(sandbox);
vm.runInContext(
  fs.readFileSync(path.join(root, "js", "rules.js"), "utf8"),
  sandbox,
  { filename: "js/rules.js" }
);

let failures = [];
function check(label, actual, expected) {
  const ok = JSON.stringify(actual) === JSON.stringify(expected);
  if (!ok) failures.push(label + ": got " + JSON.stringify(actual));
  console.log((ok ? "PASS" : "FAIL") + "  " + label + "  actual=" + JSON.stringify(actual));
}

/* 3 rows x 2 cols; answers chosen so each index is distinguishable. */
const spec = {
  name: "3 x 1 addition",
  operator: "+",
  rows: [10, 20, 30],
  cols: [1, 2],
  answers: [
    ["11", "12"],
    ["21", "22"],
    ["31", "32"]
  ],
  answerFormat: "integer"
};

console.log("-- work-order indexing (index = col * rowCount + row) --");
const allCorrect = [
  "11", "21", "31", /* column 0, top to bottom */
  "12", "22", "32"  /* column 1 */
];
check("all correct: results", sandbox.SOM.rules.grade(spec, allCorrect, 0).results,
  [true, true, true, true, true, true]);

const oneWrong = allCorrect.slice();
oneWrong[4] = "99"; /* row 1, col 1 -> index 1*3 + 1 = 4 */
check("wrong cell lands on its work-order index",
  sandbox.SOM.rules.grade(spec, oneWrong, 0).results,
  [true, true, true, true, false, true]);

console.log("\n-- exact string comparison --");
const leadingZero = allCorrect.slice();
leadingZero[0] = "011"; /* typed longer than the answer */
check("extra digits are not correct",
  sandbox.SOM.rules.grade(spec, leadingZero, 0).results[0], false);

/* 17 / 5 = 3r2; 60 / 5 = 12 exactly (zero remainder -> plain quotient). */
const divSpec = {
  name: "2 x 1 division",
  operator: "/",
  rows: [17, 60],
  cols: [5],
  answers: [["3r2"], ["12"]],
  answerFormat: "quotientRemainder"
};
check("division '3r2' matches exactly",
  sandbox.SOM.rules.grade(divSpec, ["3r2"], 0).results[0], true);
check("division '3 r 2' is not accepted",
  sandbox.SOM.rules.grade(divSpec, ["3 r 2"], 0).results[0], false);
check("division quotient-only '3' is not accepted",
  sandbox.SOM.rules.grade(divSpec, ["3"], 0).results[0], false);
check("zero remainder written as plain quotient",
  sandbox.SOM.rules.grade(divSpec, ["3r2", "12"], 0).results[1], true);
check("'12r0' is not accepted for a zero remainder",
  sandbox.SOM.rules.grade(divSpec, ["3r2", "12r0"], 0).results[1], false);

console.log("\n-- numeric answers (operator modules emit numbers) --");
const numSpec = {
  name: "2 x 1 addition",
  operator: "+",
  rows: [1, 2],
  cols: [3],
  answers: [[4], [5]], /* numbers, as js/generators/add.js emits them */
  answerFormat: "integer"
};
check("typed \"4\" matches numeric answer 4",
  sandbox.SOM.rules.grade(numSpec, ["4", "5"], 0).results[0], true);
check("typed \"04\" does not match numeric answer 4",
  sandbox.SOM.rules.grade(numSpec, ["04", "5"], 0).results[0], false);

console.log("\n-- empty and null entries --");
/* index 2 is row 2 / col 0 -> answer "31". */
const sparse = [null, "", "31", "12", null, "32"];
check("empty/null grade incorrect, filled grade as usual",
  sandbox.SOM.rules.grade(spec, sparse, 0).results,
  [false, false, true, true, false, true]);

console.log("\n-- score = correct + seconds remaining --");
check("score with no time left", sandbox.SOM.rules.grade(spec, sparse, 0).score, 3);
check("score adds the time bonus", sandbox.SOM.rules.grade(spec, sparse, 137).score, 140);
check("all-correct score", sandbox.SOM.rules.grade(spec, allCorrect, 60).score, 66);

console.log("\nRESULT: " + (failures.length === 0 ? "ALL CHECKS PASSED" : "FAILURES"));
failures.forEach((f) => console.log("  FAIL " + f));
process.exit(failures.length === 0 ? 0 : 1);
