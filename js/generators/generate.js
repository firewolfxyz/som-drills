/* PHASE 2 step C: grid-spec generation (docs/generation.md).
   Pure logic only: no DOM, no randomness assumptions beyond the injected rng.

   SOM.generate(entry, opts) turns ONE validated config entry into a whole grid
   spec in a single call - never individual questions:

     { name, operator, rows, cols, answers, answerFormat }

   opts (all optional except where stated):
     start    integer row-1 header with exactly rows.digits digits. The walk is
              deterministic from it: rows = [start] + SOM.walk.rowSequence(...).
     columns  array of exactly columns.count headers, each exactly
              columns.digits digits. Omit for random headers.
     signs    array of exactly rows.count values, each +1 or -1, applied to the
              row magnitudes. Only meaningful when rows.signed is true.
     rng      function returning [0, 1). Used ONLY for what the caller omits;
              defaults to Math.random. Fully deterministic when start, columns
              and signs are all supplied.

   Generation-time invariants throw loudly rather than producing a bad grid:
   row magnitudes have exactly rows.digits digits, column headers have exactly
   columns.digits digits and are never negative, and division rows are positive.
*/

(function (globalObj) {
  "use strict";

  globalObj.SOM = globalObj.SOM || {};

  /* The shared operator registry. Populated by js/generators/<operator>.js;
     created lazily so script load order never matters. */
  const registry = (globalObj.SOM.generators = globalObj.SOM.generators || {});

  function digitsOf(value) {
    return String(Math.abs(value)).length;
  }

  /* Random integer in [lo, hi] inclusive. */
  function randomInt(rng, lo, hi) {
    return lo + Math.floor(rng() * (hi - lo + 1));
  }

  /* Random header with exactly `digits` digits: the leading digit is drawn from
     1..9 so it is never 0, the rest from 0..9. Never negative. */
  function randomHeader(rng, digits) {
    let value = randomInt(rng, 1, 9);
    for (let i = 1; i < digits; i++) value = value * 10 + randomInt(rng, 0, 9);
    return value;
  }

  function makeStart(rng, digits) {
    return randomHeader(rng, digits);
  }

  /* --- option validation: fail loudly, never silently coerce --- */
  function requireInteger(name, v) {
    if (typeof v !== "number" || !Number.isInteger(v)) {
      throw new Error("generate: opts." + name + " must be an integer, got " + JSON.stringify(v));
    }
    return v;
  }

  function validateStart(entry, start) {
    if (start < 0) {
      throw new Error(
        "generate: opts.start must be a positive magnitude (the walk runs on " +
        "magnitudes; signs are assigned per row), got " + start
      );
    }
    if (digitsOf(start) !== entry.rows.digits) {
      throw new Error(
        "generate: opts.start must have exactly " + entry.rows.digits +
        " digits, got " + start
      );
    }
    return start;
  }

  function validateColumns(entry, columns) {
    if (columns.length !== entry.columns.count) {
      throw new Error(
        "generate: opts.columns must have exactly " + entry.columns.count +
        " entries, got " + columns.length
      );
    }
    columns.forEach(function (c, i) {
      if (typeof c !== "number" || !Number.isInteger(c)) {
        throw new Error("generate: opts.columns[" + i + "] must be an integer, got " + JSON.stringify(c));
      }
      if (c < 0) {
        throw new Error("generate: column headers are never negative, got " + c);
      }
      if (digitsOf(c) !== entry.columns.digits) {
        throw new Error(
          "generate: opts.columns[" + i + "] must have exactly " + entry.columns.digits +
          " digits, got " + c
        );
      }
    });
    return columns;
  }

  function validateSigns(entry, signs) {
    if (signs.length !== entry.rows.count) {
      throw new Error(
        "generate: opts.signs must have exactly " + entry.rows.count +
        " entries, got " + signs.length
      );
    }
    signs.forEach(function (s, i) {
      if (s !== 1 && s !== -1) {
        throw new Error("generate: opts.signs[" + i + "] must be +1 or -1, got " + JSON.stringify(s));
      }
    });
    return signs;
  }

  function generate(entry, opts) {
    if (entry === null || typeof entry !== "object" || Array.isArray(entry)) {
      throw new Error("generate: config entry must be an object");
    }
    const compute = registry[entry.operator];
    if (typeof compute !== "function") {
      throw new Error(
        "generate: no generator registered for operator " + JSON.stringify(entry.operator) +
        "; registered: " + Object.keys(registry).sort().join(", ")
      );
    }
    const options = opts || {};
    /* A seeded rng is honoured exactly; unseeded calls must not consume it. */
    const rng = options.rng === undefined ? Math.random : options.rng;
    if (typeof rng !== "function") {
      throw new Error("generate: opts.rng must be a function returning [0, 1)");
    }

    /* --- rows: start, then walk continuations, magnitudes first --- */
    let start;
    if (options.start === undefined) {
      start = makeStart(rng, entry.rows.digits);
    } else {
      start = validateStart(entry, requireInteger("start", options.start));
    }
    const magnitudes = [start].concat(globalObj.SOM.walk.rowSequence(start, entry.rows.count - 1));

    /* --- signs: only when the drill declares signed rows in play --- */
    if (options.signs !== undefined && !entry.rows.signed) {
      throw new Error(
        "generate: opts.signs given for a drill with rows.signed false (" + entry.name + ")"
      );
    }
    const rows = magnitudes.map(function (magnitude, i) {
      if (!entry.rows.signed) return magnitude;
      let sign;
      if (options.signs !== undefined) {
        sign = validateSigns(entry, options.signs)[i];
      } else {
        sign = rng() < 0.5 ? -1 : 1; /* random per row when not supplied */
      }
      return sign * magnitude;
    });

    /* Division never runs on negatives (docs/config.md). */
    if (entry.operator === "divide") {
      rows.forEach(function (r, i) {
        if (r <= 0) {
          throw new Error("generate: division rows must be positive, got " + r + " at row " + i);
        }
      });
    }

    /* --- columns: never negative, never random-signed --- */
    let cols;
    if (options.columns === undefined) {
      cols = [];
      for (let i = 0; i < entry.columns.count; i++) cols.push(randomHeader(rng, entry.columns.digits));
    } else {
      cols = validateColumns(entry, options.columns);
    }

    /* --- answers: one compute call per cell, on the ACTUAL signed row --- */
    const answers = rows.map(function (row) {
      return cols.map(function (col) {
        return compute(row, col);
      });
    });

    return {
      name: entry.name,
      operator: entry.operator,
      rows: rows,
      cols: cols,
      answers: answers,
      answerFormat: entry.answer,
      seconds: entry.seconds
    };
  }

  globalObj.SOM.generate = generate;
})(typeof window !== "undefined" ? window : globalThis);
