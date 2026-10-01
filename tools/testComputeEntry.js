/* tools/testComputeEntry.js — pure checks for rules.computeEntry,
   rules.computeDisplay and rules.headLenFor (compute-style digit entry).
   Run: node tools/testComputeEntry.js */

"use strict";

const fs = require("fs");
const path = require("path");
const vm = require("vm");

const root = path.join(__dirname, "..");
const sandbox = { console: console };
sandbox.window = sandbox;
vm.createContext(sandbox);
vm.runInContext(fs.readFileSync(path.join(root, "js/rules.js"), "utf8"), sandbox, {
  filename: "js/rules.js"
});

let failed = 0;
function check(label, actual, expected) {
  const a = JSON.stringify(actual);
  const e = JSON.stringify(expected);
  if (a === e) {
    console.log("PASS  " + label + "  actual=" + a);
  } else {
    failed += 1;
    console.log("FAIL  " + label + "\n      expected " + e + "\n      actual   " + a);
  }
}

const C = sandbox.SOM.rules.computeEntry;
const D = sandbox.SOM.rules.computeDisplay;
const H = sandbox.SOM.rules.headLenFor;

/* --- computeEntry: the typed string for an answer --- */

/* The motivating example: 338 x 5 = 1690, typed 0,9,1,6. */
check("1690 singles 2 -> 0916", C("1690", 2), "0916");

/* Addition: 97+9=106 -> type 6, then chunk "10". */
check("106 singles 1 -> 610", C("106", 1), "610");
check("58+7=65 singles 1 -> 56", C("65", 1), "56");

/* No overflow: the single digit is written, then a 1-digit chunk. */
check("36 singles 1 -> 63", C("36", 1), "63");
check("5 singles 1 -> 5", C("5", 1), "5");

/* Leading zeros survive: 12 x 5 = 60 -> type 0, then chunk "6". */
check("60 singles 1 -> 06", C("60", 1), "06");
check("160 singles 2 -> 061", C("160", 2), "061");

/* singles >= length: nothing to reverse, typed normally. */
check("1234 singles 4 -> 1234", C("1234", 4), "1234");

/* --- computeDisplay: live layout + next-digit position --- */

/* 338 x 5 = 1690, singles 2: type 0, 9, then the chunk 16. */
check("display empty", D("1690", "", 2), { text: "    ", pos: 3 });
check("display after 0", D("1690", "0", 2), { text: "   0", pos: 2 });
check("display after 09", D("1690", "09", 2), { text: "  90", pos: 0 });
check("display after 091", D("1690", "091", 2), { text: "1 90", pos: 1 });
check("display complete", D("1690", "0916", 2), { text: "1690", pos: null });

/* 97+9 = 106, singles 1: type 6, then the chunk 10. */
check("display 106 empty", D("106", "", 1), { text: "   ", pos: 2 });
check("display 106 after 6", D("106", "6", 1), { text: "  6", pos: 0 });
check("display 106 after 61", D("106", "61", 1), { text: "1 6", pos: 1 });
check("display 106 complete", D("106", "610", 1), { text: "106", pos: null });

/* 12 x 3 = 36, singles 1: type 6, then the chunk 3. */
check("display 36 after 6", D("36", "6", 1), { text: " 6", pos: 0 });
check("display 36 complete", D("36", "63", 1), { text: "36", pos: null });

/* Single-digit answer: one slot, typed as-is. */
check("display 5 empty", D("5", "", 1), { text: " ", pos: 0 });
check("display 5 complete", D("5", "5", 1), { text: "5", pos: null });

/* Negative answers: the sign is a toggle prefix, not part of the typed
   buffer. computeDisplay takes a 4th `negative` flag. */
check("display neg empty", D("-1690", "", 2, true), { text: "-    ", pos: 4 });
check("display neg after 0", D("-1690", "0", 2, true), { text: "-   0", pos: 3 });
check("display neg after 09", D("-1690", "09", 2, true), { text: "-  90", pos: 1 });
check("display neg after 091", D("-1690", "091", 2, true), { text: "-1 90", pos: 2 });
check("display neg complete", D("-1690", "0916", 2, true), { text: "-1690", pos: null });

/* --- headLenFor: the `singles` count per drill spec --- */

/* add/subtract: max row digits - 1 (the last digit's sum is the chunk). */
check("add headLen", H({ operator: "add", rows: [12, -97, 58], cols: [3, 4] }), 1);
check("signed subtract headLen uses magnitudes",
  H({ operator: "subtract", rows: [-12, 7], cols: [3] }), 1);
check("1-digit add headLen floors at 1",
  H({ operator: "add", rows: [7, 9], cols: [3] }), 1);

/* multiply: left factor digits - 1. */
check("multiply 2x1 headLen 1",
  H({ operator: "multiply", rows: [12, 97], cols: [5, 6] }), 1);
check("multiply 3x1 headLen 2",
  H({ operator: "multiply", rows: [338], cols: [10, 23] }), 2);

/* divide: null (plain left-to-right entry). */
check("divide headLen is null",
  H({ operator: "divide", rows: [338], cols: [5] }), null);

if (failed > 0) {
  console.log("\n" + failed + " CHECK(S) FAILED");
  process.exit(1);
}
console.log("\nALL CHECKS PASSED");
