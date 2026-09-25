/* Pure logic test for js/walk.js (no DOM). Run: node tools/testWalk.js
   Checks every reference in docs/generation.md "Row-number walk". */

const fs = require("fs");
const path = require("path");
const vm = require("vm");

/* Load the real file the way index.html would: classic script on a global. */
const context = vm.createContext({ console, window: {} });
const src = fs.readFileSync(path.join(__dirname, "..", "js", "walk.js"), "utf8");
vm.runInContext(src, context, { filename: "js/walk.js" });
const rowSequence = context.window.SOM.walk.rowSequence;

let failures = 0;
function check(name, actual, expected) {
  const ok = JSON.stringify(actual) === JSON.stringify(expected);
  if (!ok) failures++;
  console.log((ok ? "PASS " : "FAIL ") + name + (ok ? "" : " got " + JSON.stringify(actual)));
}

/* --- worked examples: derived rows only, start not included --- */
check("1-digit 7 -> 3 6 9 2 5 8 1", rowSequence(7, 7), [3, 6, 9, 2, 5, 8, 1]);
check("2-digit 12", rowSequence(12, 7), [49, 76, 33, 60, 97, 24, 51]);
check("3-digit 123", rowSequence(123, 7), [496, 769, 332, 605, 978, 241, 514]);
check("3-digit 999", rowSequence(999, 7), [262, 535, 808, 171, 444, 717, 380]);

/* --- leading-zero -> 3 rule fires on grid row 4 (start is row 1) --- */
check("leading-zero substitution on grid row 4", rowSequence(123, 3)[2], 332);

/* --- 1-digit period 9: the 9th derived value returns to the start --- */
check("1-digit period 9 (start 7)", rowSequence(7, 9), [3, 6, 9, 2, 5, 8, 1, 4, 7]);

/* --- property sweep over every start of each length 1..4 --- */
function startsOfLength(len) {
  /* Row headers never start with 0, so 1-digit starts are 1..9. */
  const first = len === 1 ? 1 : Math.pow(10, len - 1);
  const last = Math.pow(10, len) - 1;
  const out = [];
  for (let v = first; v <= last; v++) out.push(v);
  return out;
}

let digitLenBad = 0;
let countBad = 0;

/* Only a 1-digit 10-row grid is expected to repeat (period 9 puts the start
   back on row 10); every other grid of every length must be duplicate-free. */
function duplicatesExpected(len, gridSize) {
  return len === 1 && gridSize === 10;
}

[1, 2, 3, 4].forEach((len) => {
  const starts = startsOfLength(len);
  [8, 10].forEach((gridSize) => {
    const expectDup = duplicatesExpected(len, gridSize);
    starts.forEach((start) => {
      /* A grid's rows are the start plus (gridSize - 1) walked values. */
      const rows = [start].concat(rowSequence(start, gridSize - 1));
      if (rows.length !== gridSize) countBad++;

      const seen = new Set();
      let dup = false;
      rows.forEach((r) => {
        if (seen.has(r)) dup = true;
        seen.add(r);
        /* every generated value keeps the start's digit count */
        if (String(r).length !== len) digitLenBad++;
      });
      if (dup !== expectDup) {
        failures++;
        console.log(
          "FAIL duplicate rows len=" + len + " grid=" + gridSize +
          " start=" + start + " dup=" + dup
        );
      }
    });
    console.log(
      "PASS sweep len=" + len + " grid=" + gridSize +
      " starts=" + starts.length +
      (expectDup ? " (period-9 repeat on row 10)" : " (no duplicates)")
    );
  });
});

check("count always honoured", countBad, 0);
check("digit count preserved everywhere", digitLenBad, 0);

console.log(failures === 0 ? "ALL CHECKS PASSED" : "CHECKS FAILED: " + failures);
process.exit(failures === 0 ? 0 : 1);
