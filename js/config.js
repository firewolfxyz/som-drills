/* PHASE 2 step A: the drill catalogue as configuration (docs/config.md).
   The catalogue is a JS data module, not fetched JSON: file:// blocks fetch,
   and this app must run by double-clicking index.html with no server.
   window.SOM.config exposes the entries and validate(entry), which fails
   LOUDLY at load/validation time — never silently at play time. */

window.SOM = window.SOM || {};

(function () {
  "use strict";

  const OPERATORS = ["add", "subtract", "multiply", "divide"];
  const OPERATOR_WORDS = {
    add: "addition",
    subtract: "subtraction",
    multiply: "multiplication",
    divide: "division"
  };
  const ANSWERS = ["integer", "quotientRemainder"];
  /* Declared pace: cell count -> seconds. Any other combo is rejected. */
  const PACE = { 40: 300, 80: 600 };

  function fail(entry, field, message) {
    const label = entry && entry.name ? entry.name : "<unnamed entry>";
    throw new Error("config entry \"" + label + "\": " + (field ? field + ": " : "") + message);
  }

  function isPositiveInteger(v) {
    return typeof v === "number" && Number.isInteger(v) && v > 0;
  }

  /* Structural checks first so later rules can assume well-formed fields. */
  function checkStructure(entry) {
    if (entry === null || typeof entry !== "object" || Array.isArray(entry)) {
      fail(entry, null, "entry must be an object");
    }
    ["name", "operator", "rows", "columns", "seconds", "answer"].forEach(function (field) {
      if (!(field in entry)) fail(entry, field, "required field missing");
    });
    if (typeof entry.name !== "string" || entry.name === "") {
      fail(entry, "name", "must be a non-empty string");
    }
    ["rows", "columns"].forEach(function (field) {
      const sub = entry[field];
      if (sub === null || typeof sub !== "object" || Array.isArray(sub)) {
        fail(entry, field, "must be an object");
      }
      ["count", "digits"].forEach(function (k) {
        if (!(k in sub)) fail(entry, field + "." + k, "required field missing");
        if (!isPositiveInteger(sub[k])) {
          fail(entry, field + "." + k, "must be a positive integer, got " + JSON.stringify(sub[k]));
        }
      });
    });
    if (!("signed" in entry.rows)) fail(entry, "rows.signed", "required field missing");
    if (typeof entry.rows.signed !== "boolean") {
      fail(entry, "rows.signed", "must be true or false");
    }
    if (!isPositiveInteger(entry.seconds)) {
      fail(entry, "seconds", "must be a positive integer, got " + JSON.stringify(entry.seconds));
    }
  }

  function checkRules(entry) {
    if (OPERATORS.indexOf(entry.operator) === -1) {
      fail(entry, "operator", "must be one of " + OPERATORS.join(", ") + ", got " + JSON.stringify(entry.operator));
    }
    if (ANSWERS.indexOf(entry.answer) === -1) {
      fail(entry, "answer", "must be one of " + ANSWERS.join(", ") + ", got " + JSON.stringify(entry.answer));
    }
    /* 1-digit row headers cycle at 9 and would repeat inside a 10-row grid. */
    if (entry.rows.count === 10 && entry.rows.digits < 2) {
      fail(entry, "rows.digits", "must be >= 2 when rows.count is 10 (1-digit rows repeat), got " + entry.rows.digits);
    }
    if (entry.rows.signed && entry.operator === "divide") {
      fail(entry, "rows.signed", "signed rows are not allowed with operator \"divide\"");
    }
    /* answer format must match the operator family. */
    if (entry.answer === "quotientRemainder" && entry.operator !== "divide") {
      fail(entry, "answer", "\"quotientRemainder\" is only valid for operator \"divide\"");
    }
    if (entry.answer === "integer" && entry.operator === "divide") {
      fail(entry, "answer", "operator \"divide\" requires answer \"quotientRemainder\"");
    }
    /* Cell count vs seconds pace. */
    const cells = entry.rows.count * entry.columns.count;
    if (!(cells in PACE)) {
      fail(entry, "rows.count/columns.count", "grid has " + cells + " cells; only 40 or 80 are allowed");
    } else if (PACE[cells] !== entry.seconds) {
      fail(entry, "seconds", cells + " cells require " + PACE[cells] + " s, got " + entry.seconds);
    }
    /* Name convention: "<rows.digits> x <columns.digits> <operator-word>". */
    const expectedName = entry.rows.digits + " x " + entry.columns.digits + " " + OPERATOR_WORDS[entry.operator];
    if (entry.name !== expectedName) {
      fail(entry, "name", "expected \"" + expectedName + "\", got \"" + entry.name + "\"");
    }
  }

  function validate(entry) {
    checkStructure(entry);
    checkRules(entry);
    return entry;
  }

  /* The catalogue. Authored incrementally per docs/config.md. */
  const entries = [
    {
      name: "2 x 1 addition",
      operator: "add",
      rows: { count: 8, digits: 2, signed: false },
      columns: { count: 5, digits: 1 },
      seconds: 300,
      answer: "integer"
    }
  ];

  /* Fail loudly at load time on any bad catalogue entry. */
  entries.forEach(validate);

  window.SOM.config = { entries: entries, validate: validate };
})();
