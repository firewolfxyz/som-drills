/* Phase 2 step C: operator "add" (docs/generation.md).
   Pure logic only: no DOM, no config reading, no randomness. Each operator
   module registers its compute into the shared registry SOM.generators, which
   is created lazily here so script load order never matters.

   compute(row, col) takes the ACTUAL signed row value and a positive column
   header and returns the answer for that cell: an integer for every operator
   except "divide". */

(function (globalObj) {
  globalObj.SOM = globalObj.SOM || {};
  const registry = (globalObj.SOM.generators = globalObj.SOM.generators || {});

  function compute(row, col) {
    return row + col;
  }

  registry.add = compute;
})(typeof window !== "undefined" ? window : globalThis);
