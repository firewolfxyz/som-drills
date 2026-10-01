/* Key mapping for entry, in one place so the commit key can be swapped without
   touching anything else (operator has not finalised it; space is the candidate).

   No minus sign and no "r" separator yet: those belong to signed-row and
   division drills, which are later phases. */

window.SOM = window.SOM || {};

window.SOM.keys = (function () {
  const COMMIT_CODES = ["Space", "Enter", "NumpadEnter"];

  /* Returns { action: "digit"|"commit"|"back"|"ignore", char: string|null }. */
  function actionFor(event) {
    const code = event.code || "";
    const digit = /^Digit([0-9])$/.exec(code) || /^Numpad([0-9])$/.exec(code);
    if (digit) return { action: "digit", char: digit[1] };

    if (COMMIT_CODES.indexOf(code) !== -1) return { action: "commit", char: null };
    if (code === "Backspace") return { action: "back", char: null };
    if (code === "NumpadSubtract" || code === "Minus")
      return { action: "minus", char: null };

    // event.key fallback: laptops report differing codes for some keyboards.
    if (/^[0-9]$/.test(event.key)) return { action: "digit", char: event.key };
    if (event.key === "Enter" || event.key === " ")
      return { action: "commit", char: null };
    if (event.key === "Backspace") return { action: "back", char: null };
    if (event.key === "-") return { action: "minus", char: null };

    return { action: "ignore", char: null };
  }

  return { actionFor: actionFor };
})();
