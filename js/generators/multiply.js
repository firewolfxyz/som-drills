/* Phase 2 step C: operator "multiply" (docs/generation.md).
   Pure logic only. Signed row values multiply as usual, so a negative row
   yields negative answers; that is intended for signed drills. */

(function (globalObj) {
  globalObj.SOM = globalObj.SOM || {};
  const registry = (globalObj.SOM.generators = globalObj.SOM.generators || {});

  function compute(row, col) {
    return row * col;
  }

  registry.multiply = compute;
})(typeof window !== "undefined" ? window : globalThis);
