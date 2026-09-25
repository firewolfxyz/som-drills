/* Phase 2 step B: the row-number walk (docs/generation.md "Row-number walk").
   Pure logic only: no DOM, no config reading, no randomness. The caller owns
   the random start; the walk is fully deterministic from it.

   Rule recap:
     - Positions are counted from the LEFT (leftmost digit is position 0).
     - Steps alternate: even positions +3, odd positions -3.
     - Each digit step wraps mod 10.
     - Leading-digit rule: if a step lands the leftmost digit on 0, substitute 3.
     - The walk runs on magnitudes only; signs are assigned elsewhere.

   rowSequence(start, count) returns exactly `count` magnitudes derived from
   `start` (the start itself is not included - the doc's worked examples list
   the derived rows only). */

(function (globalObj) {
  globalObj.SOM = globalObj.SOM || {};

  /* Step applied to the digit at position i: +3 on even positions, -3 odd. */
  function stepFor(i) {
    return i % 2 === 0 ? 3 : -3;
  }

  /* One walk step, magnitude in / magnitude out. */
  function nextValue(value) {
    const digits = String(value).split("");
    for (let i = 0; i < digits.length; i++) {
      let d = (Number(digits[i]) + stepFor(i)) % 10; /* wrap mod 10 */
      if (d < 0) d += 10;                            /* JS % keeps the sign */
      if (i === 0 && d === 0) d = 3;                 /* leading-digit rule */
      digits[i] = String(d);
    }
    return Number(digits.join(""));
  }

  function rowSequence(start, count) {
    const rows = [];
    let value = Math.abs(Math.trunc(Number(start))); /* magnitudes only */
    const n = Math.max(0, Math.trunc(Number(count) || 0));
    while (rows.length < n) {
      value = nextValue(value);
      rows.push(value);
    }
    return rows;
  }

  globalObj.SOM.walk = { rowSequence: rowSequence };
})(typeof window !== "undefined" ? window : globalThis);
