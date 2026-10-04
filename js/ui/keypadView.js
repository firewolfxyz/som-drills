/* UI only: an on-screen keypad for touch devices (docs/phases.md Phase 5).
   Renders big touch targets: digits 0-9, backspace, minus, the r separator
   and commit, and reports taps as the same actions the keyboard maps to
   (js/keys.js). It decides nothing about work order or correctness;
   main.js forwards each tap to state.handle exactly like a mapped key event.

   The keypad lives OUTSIDE #app so view re-renders (drill -> result) do not
   destroy it; show/hide is driven by the session's lifecycle in main.js. */

window.SOM = window.SOM || {};

window.SOM.keypadView = (function () {
  function el(tag, className, text) {
    const node = document.createElement(tag);
    if (className) node.className = className;
    if (text !== undefined) node.textContent = String(text);
    return node;
  }

  /* onAction(action, char) mirrors state.handle: "digit" with the char,
     "back"/"commit" with null. */
  function render(container, onAction) {
    container.innerHTML = "";
    const pad = el("div", "keypad");

    for (let d = 1; d <= 9; d++) {
      pad.appendChild(makeKey(String(d), "digit"));
    }
    pad.appendChild(makeKey("\u232B", "back")); /* backspace glyph */
    pad.appendChild(makeKey("0", "digit"));
    pad.appendChild(makeKey("-", "minus")); /* signed drills need the sign key */
    /* Quotient+remainder separator for division answers ("3r2"); state.js
       ignores it in drills whose answers have no remainder. */
    pad.appendChild(makeKey("r", "sep"));
    pad.appendChild(makeKey("ok", "commit"));

    container.appendChild(pad);

    function makeKey(label, action) {
      const key = el("button", "keypad-key", label);
      key.type = "button";
      /* pointerdown fires before click and before the finger lifts: fastest
         path for a drill, and it avoids the 300ms-style click delay some
         mobile browsers add. */
      key.addEventListener("pointerdown", function (event) {
        event.preventDefault();
        const char = (action === "digit" || action === "sep") ? label : null;
        onAction(action, char);
      });
      return key;
    }
  }

  function show(container) {
    container.hidden = false;
  }

  function hide(container) {
    container.hidden = true;
  }

  return { render: render, show: show, hide: hide };
})();
