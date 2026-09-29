/* Phase 2 step D: a tiny seeded RNG (pure logic: no DOM, no config reading,
   no generation). SOM.generate accepts an rng function returning [0, 1) via
   opts.rng; SOM.random.seeded(seed) provides a deterministic one so a session
   can be reproduced from a seed (index.html#seed=1234567890 in the browser).

   The generator is a plain linear congruential generator - reproducible, not
   cryptographic. parseSeed(text) extracts "seed=<integer>" from an arbitrary
   string (a URL fragment or query), so this module never touches location. */

(function (globalObj) {
  "use strict";

  globalObj.SOM = globalObj.SOM || {};

  function seeded(seed) {
    let state = Math.trunc(Number(seed) || 0) >>> 0;
    return function () {
      /* Multiplication stays below 2^53, so it is exact in a double. */
      state = (state * 1664525 + 1013904223) >>> 0;
      return state / 4294967296;
    };
  }

  function parseSeed(text) {
    const raw = String(text || "");
    let decoded = raw;
    /* Percent-decode defensively; a hand-written fragment is usually plain. */
    try {
      decoded = decodeURIComponent(raw);
    } catch (err) {
      decoded = raw;
    }
    const match = /seed=(-?\d+)(?:$|[&\s])/.exec(decoded.replace(/^#/, ""));
    return match === null ? null : Number(match[1]);
  }

  globalObj.SOM.random = { seeded: seeded, parseSeed: parseSeed };
})(typeof window !== "undefined" ? window : globalThis);
