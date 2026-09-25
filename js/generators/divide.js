/* Phase 2 step C: operator "divide" (docs/generation.md "Division answers").
   Pure logic only. A division cell holds quotient r remainder, e.g. 17 / 5 is
   "3r2". When the remainder is 0 ONLY the quotient is written - "62", never
   "62r0" - so answer widths vary per cell and cannot be inferred from length.

   Division rows are always positive magnitudes (docs/config.md: no division
   with negatives), enforced loudly here as well as by config validation. */

(function (globalObj) {
  globalObj.SOM = globalObj.SOM || {};
  const registry = (globalObj.SOM.generators = globalObj.SOM.generators || {});

  function compute(row, col) {
    if (!Number.isInteger(row) || row <= 0) {
      throw new Error("divide: rows must be positive integers, got " + JSON.stringify(row));
    }
    if (!Number.isInteger(col) || col <= 0) {
      throw new Error("divide: columns must be positive integers, got " + JSON.stringify(col));
    }
    const quotient = Math.floor(row / col);
    const remainder = row % col;
    return remainder === 0 ? String(quotient) : quotient + "r" + remainder;
  }

  registry.divide = compute;
})(typeof window !== "undefined" ? window : globalThis);
