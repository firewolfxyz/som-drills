/* Pure-logic test for js/config.js (no DOM). Run: node tools/testConfig.js
   Loads the real config module in a bare sandbox, validates the real
   catalogue, then checks every rule in docs/config.md against bad entries. */

const fs = require("fs");
const path = require("path");
const vm = require("vm");

const root = path.join(__dirname, "..");
const sandbox = { console: console };
sandbox.window = sandbox;
vm.createContext(sandbox);
vm.runInContext(fs.readFileSync(path.join(root, "js", "config.js"), "utf8"), sandbox, {
  filename: "js/config.js"
});
const config = sandbox.SOM.config;

let failures = 0;
function pass(label) { console.log("PASS  " + label); }
function fail(label, detail) {
  failures += 1;
  console.log("FAIL  " + label + (detail ? "  (" + detail + ")" : ""));
}

/* ---------- the real catalogue must validate cleanly ---------- */
try {
  config.entries.forEach(config.validate);
  pass("real catalogue (" + config.entries.length + " entries) validates");
} catch (e) {
  fail("real catalogue", e.message);
}

/* ---------- bad entries: each must throw with a clear message ---------- */
function good() {
  return {
    name: "2 x 1 addition",
    operator: "add",
    rows: { count: 8, digits: 2, signed: false },
    columns: { count: 5, digits: 1 },
    seconds: 300,
    answer: "integer"
  };
}

const bad = [];
function expectThrow(label, entry) { bad.push({ label, entry }); }

/* rows.digits >= 2 when rows.count === 10 */
let e = good(); e.rows = { count: 10, digits: 1, signed: false }; e.columns.count = 4;
expectThrow("10 rows with 1-digit headers", e);
/* signed rows must not divide */
e = good(); e.operator = "divide"; e.answer = "quotientRemainder"; e.rows.signed = true;
e.name = "2 x 1 division";
expectThrow("signed division", e);
/* quotientRemainder only for divide */
e = good(); e.answer = "quotientRemainder";
expectThrow("quotientRemainder on add", e);
/* integer rejected for divide */
e = good(); e.operator = "divide"; e.name = "2 x 1 division";
expectThrow("integer answer on divide", e);
/* valid signed division variant must PASS */
e = good(); e.operator = "divide"; e.answer = "quotientRemainder"; e.name = "2 x 1 division";
try { config.validate(e); pass("unsigned division accepted"); }
catch (err) { fail("unsigned division accepted", err.message); }
/* pace: wrong seconds for cell count */
e = good(); e.seconds = 600;
expectThrow("40 cells with 600 s", e);
/* pace: unknown cell count */
e = good(); e.rows.count = 6; e.columns.count = 5; /* 30 cells */
expectThrow("30-cell grid rejected", e);
/* missing fields */
e = good(); delete e.seconds;
expectThrow("missing seconds", e);
e = good(); delete e.rows.digits;
expectThrow("missing rows.digits", e);
e = good(); delete e.rows.signed;
expectThrow("missing rows.signed", e);
/* bad operator */
e = good(); e.operator = "modulo";
expectThrow("unknown operator", e);
/* non-integer / non-positive counts and digits */
e = good(); e.rows.count = 8.5;
expectThrow("fractional rows.count", e);
e = good(); e.columns.digits = 0;
expectThrow("zero columns.digits", e);
e = good(); e.columns.count = -5;
expectThrow("negative columns.count", e);
/* name convention */
e = good(); e.name = "3 x 1 addition";
expectThrow("name digits mismatch", e);
e = good(); e.name = "2 x 1 add";
expectThrow("name operator-word mismatch", e);
/* signed marker: unsigned entry must not carry it */
e = good(); e.name = "2 x 1 signed addition";
expectThrow("unsigned name with signed marker", e);
/* signed marker: a valid signed entry must PASS */
e = good(); e.rows.signed = true; e.name = "2 x 1 signed addition";
try { config.validate(e); pass("signed name accepted"); }
catch (err) { fail("signed name accepted", err.message); }
/* signed marker: a signed entry missing the marker must FAIL */
e = good(); e.rows.signed = true; e.name = "2 x 1 addition";
expectThrow("signed name missing marker", e);
/* dimension suffix: an 80-cell twin keeps its dimensions in the name */
e = good(); e.rows.count = 10; e.columns.count = 8; e.seconds = 600;
e.name = "2 x 1 addition 10x8";
try { config.validate(e); pass("80-cell dimension suffix accepted"); }
catch (err) { fail("80-cell dimension suffix accepted", err.message); }
/* dimension suffix: missing on a non-default grid must FAIL */
e = good(); e.rows.count = 10; e.columns.count = 8; e.seconds = 600;
e.name = "2 x 1 addition";
expectThrow("80-cell name missing dimension suffix", e);
/* dimension suffix: present on the default 8x5 must FAIL */
e = good(); e.name = "2 x 1 addition 8x5";
expectThrow("default grid with dimension suffix", e);

bad.forEach(function (t) {
  try {
    config.validate(t.entry);
    fail(t.label, "no throw");
  } catch (err) {
    if (!/config entry/.test(err.message)) {
      fail(t.label, "unclear message: " + err.message);
    } else {
      pass(t.label + " throws");
    }
  }
});

console.log("\nRESULT: " + (failures === 0 ? "ALL CHECKS PASSED" : failures + " FAILURES"));
process.exit(failures === 0 ? 0 : 1);
