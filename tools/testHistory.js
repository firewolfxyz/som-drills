/* History checks (no browser). Run: node tools/testHistory.js

   Loads js/history.js into a sandbox with a fake localStorage and proves:
     1. bestFor is null for a never-run drill.
     2. The first recorded run is a new best and is stored.
     3. A worse run (fewer correct) does not displace the best.
     4. More correct displaces it; same correct with more seconds left
        (faster) also displaces it; same correct with less time does not.
     5. Records are keyed per drill name and do not leak between drills.
     6. When localStorage throws, the module falls back to in-memory state
        for the life of the page (the drill never breaks).
     7. clear() wipes every stored record. */

const fs = require("fs");
const path = require("path");
const vm = require("vm");

const root = path.join(__dirname, "..");

let failures = 0;
function check(label, actual, expected) {
  const ok = JSON.stringify(actual) === JSON.stringify(expected);
  if (!ok) failures++;
  console.log((ok ? "PASS  " : "FAIL  ") + label + (ok ? "" : "  got " + JSON.stringify(actual)));
}

function makeLocalStorage() {
  const map = {};
  return {
    getItem: (k) => (Object.prototype.hasOwnProperty.call(map, k) ? map[k] : null),
    setItem: (k, v) => { map[k] = String(v); },
    removeItem: (k) => { delete map[k]; }
  };
}

function loadHistory(localStorageObj) {
  const sandbox = { console: console, localStorage: localStorageObj };
  sandbox.window = sandbox;
  vm.createContext(sandbox);
  vm.runInContext(
    fs.readFileSync(path.join(root, "js", "history.js"), "utf8"),
    sandbox,
    { filename: "js/history.js" }
  );
  return sandbox.SOM.history;
}

/* ---------- 1-5: normal localStorage behaviour ---------- */
console.log("\n-- history with a working localStorage --");
const h = loadHistory(makeLocalStorage());

check("never-run drill has no best", h.bestFor("2 x 1 addition"), null);

let r = h.record("2 x 1 addition", 30, 40, 120);
check("first run is a new best", r.isBest, true);
check("best stored after first run", h.bestFor("2 x 1 addition"),
  { correct: 30, total: 40, secondsLeft: 120 });

r = h.record("2 x 1 addition", 25, 40, 200);
check("worse run is not a new best", r.isBest, false);
check("best unchanged after worse run", h.bestFor("2 x 1 addition"),
  { correct: 30, total: 40, secondsLeft: 120 });

r = h.record("2 x 1 addition", 35, 40, 10);
check("more correct is a new best", r.isBest, true);
check("best updated to more correct", h.bestFor("2 x 1 addition"),
  { correct: 35, total: 40, secondsLeft: 10 });

r = h.record("2 x 1 addition", 35, 40, 60);
check("same correct, more time left is a new best", r.isBest, true);
check("best updated to faster run", h.bestFor("2 x 1 addition"),
  { correct: 35, total: 40, secondsLeft: 60 });

r = h.record("2 x 1 addition", 35, 40, 30);
check("same correct, less time left is NOT a new best", r.isBest, false);

/* Per-drill isolation. */
h.record("2 x 1 division", 40, 40, 5);
check("other drills keep their own best", h.bestFor("2 x 1 addition"),
  { correct: 35, total: 40, secondsLeft: 60 });
check("second drill stored independently", h.bestFor("2 x 1 division"),
  { correct: 40, total: 40, secondsLeft: 5 });

/* ---------- 6: broken localStorage falls back to memory ---------- */
console.log("\n-- history with a throwing localStorage --");
const broken = {
  getItem() { throw new Error("SecurityError"); },
  setItem() { throw new Error("SecurityError"); },
  removeItem() { throw new Error("SecurityError"); }
};
const hb = loadHistory(broken);
check("broken storage: first run still recorded in memory",
  hb.record("2 x 1 addition", 10, 40, 99).isBest, true);
check("broken storage: best readable from memory", hb.bestFor("2 x 1 addition"),
  { correct: 10, total: 40, secondsLeft: 99 });

/* ---------- 7: clear ---------- */
console.log("\n-- clear --");
h.clear();
check("clear wipes the first drill", h.bestFor("2 x 1 addition"), null);
check("clear wipes the second drill", h.bestFor("2 x 1 division"), null);

console.log("\nRESULT: " + (failures === 0 ? "ALL CHECKS PASSED" : failures + " FAILURES"));
process.exit(failures === 0 ? 0 : 1);
