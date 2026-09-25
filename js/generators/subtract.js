/* Phase 2 step C: operator "subtract" (docs/generation.md).
   Pure logic only. Row minus column, on the actual signed row value, so a
   negative row correctly deepens the result. */

(function (globalObj) {
  globalObj.SOM = globalObj.SOM || {};
  const registry = (globalObj.SOM.generators = globalObj.SOM.generators || {});

  function compute(row, col) {
    return row - col;
  }

  registry.subtract = compute;
})(typeof window !== "undefined" ? window : globalThis);
