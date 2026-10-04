/* UI only: the drill picker (docs/ui.md "Screens" 1). Renders one item per
   catalogue entry and reports a click as an index. It lists configs; it
   contains no rules, no generation, and no session logic — main.js decides
   what a chosen index means. */

window.SOM = window.SOM || {};

window.SOM.pickerView = (function () {
  function el(tag, className, text) {
    const node = document.createElement(tag);
    if (className) node.className = className;
    if (text !== undefined) node.textContent = String(text);
    return node;
  }

  /* Display label for each operator key. */
  const OPERATOR_LABELS = {
    add: "Addition",
    subtract: "Subtraction",
    multiply: "Multiplication",
    divide: "Division"
  };

  /* Entry modes, and the two choices that persist in localStorage:
        ltr     - type digits left to right (default).
        rtl     - type them right to left: the first digit lands rightmost.
        compute - mental-math order: type the answer from the right, final
                  carry chunk last (338 x 5 -> 0916). Division drills ignore
                  it and stay left-to-right. */
  const MODES = ["ltr", "rtl", "compute"];
  const MODE_LABELS = {
    ltr: "digits: left \u2192 right",
    rtl: "digits: right \u2192 left",
    compute: "compute order"
  };

  function readMode() {
    try {
      const saved = window.localStorage.getItem("som-entry-mode");
      return MODES.indexOf(saved) === -1 ? "ltr" : saved;
    } catch (e) { return "ltr"; /* private mode: the default */ }
  }

  function readAuto() {
    try { return window.localStorage.getItem("som-auto-advance") === "1"; }
    catch (e) { return false; }
  }

  /* The persisted choices as the options object onPick hands to main.js.
     Exported so a #drill= fragment start enters the drill the same way the
     picker would: the fragment is a shortcut into that session, not a
     different set of rules (docs/phases.md). */
  function savedOptions() {
    const mode = readMode();
    return { rtl: mode === "rtl", compute: mode === "compute", auto: readAuto() };
  }

  /* Renders the list into container, grouped under one header per
     operation. onPick(index, opts) fires when an item is clicked; opts.rtl is
     true when right-to-left entry is toggled on. Each item also carries
     data-index for tools/ checks. */
  function render(container, entries, onPick) {
    container.innerHTML = "";
    container.appendChild(el("h1", "app-title", "Spirit of Math Drills"));
    container.appendChild(el("h2", "picker-title", "choose a drill"));

    let mode = readMode();
    const dirToggle = el("button", "picker-direction", MODE_LABELS[mode]);
    dirToggle.setAttribute("aria-pressed", String(mode !== "ltr"));
    dirToggle.addEventListener("click", function () {
      mode = MODES[(MODES.indexOf(mode) + 1) % MODES.length];
      dirToggle.textContent = MODE_LABELS[mode];
      dirToggle.setAttribute("aria-pressed", String(mode !== "ltr"));
      try { window.localStorage.setItem("som-entry-mode", mode); }
      catch (e) { /* private mode: the choice just does not persist */ }
    });
    container.appendChild(dirToggle);

    /* Auto-advance toggle: a cell commits itself as soon as it holds as many
       characters as its answer, so no Enter is needed. Persists like the
       entry-mode choice. */
    let autoOn = readAuto();
    const autoToggle = el("button", "picker-direction picker-auto",
      "auto-advance: " + (autoOn ? "on" : "off"));
    autoToggle.setAttribute("aria-pressed", String(autoOn));
    autoToggle.addEventListener("click", function () {
      autoOn = !autoOn;
      autoToggle.textContent = "auto-advance: " + (autoOn ? "on" : "off");
      autoToggle.setAttribute("aria-pressed", String(autoOn));
      try { window.localStorage.setItem("som-auto-advance", autoOn ? "1" : "0"); }
      catch (e) { /* private mode: the choice just does not persist */ }
    });
    container.appendChild(autoToggle);

    function pickOpts() {
      return { rtl: mode === "rtl", compute: mode === "compute", auto: autoOn };
    }

    /* Group entries by operator, keeping catalogue order inside each group. */
    const groups = [];
    const byOperator = {};
    entries.forEach(function (entry, index) {
      let group = byOperator[entry.operator];
      if (!group) {
        group = { operator: entry.operator, items: [] };
        byOperator[entry.operator] = group;
        groups.push(group);
      }
      group.items.push({ entry: entry, index: index });
    });

    groups.forEach(function (group) {
      const label = OPERATOR_LABELS[group.operator];
      if (!label) throw new Error("picker: unknown operator " + group.operator);
      container.appendChild(el("h3", "picker-group-title", label));
      const list = el("ul", "picker-list");
      group.items.forEach(function (item) {
        const li = el("li", "picker-item");
        li.dataset.index = String(item.index);
        const button = el("button", "picker-button");
        button.appendChild(el("span", "picker-name", item.entry.name));
        /* Best run so far for this drill, if any (localStorage history). */
        const best = window.SOM.history
          ? window.SOM.history.bestFor(item.entry.name)
          : null;
        if (best) {
          button.appendChild(el(
            "span", "picker-best",
            "best " + best.correct + "/" + best.total
          ));
        }
        li.appendChild(button);
        button.addEventListener("click", function () {
          onPick(item.index, pickOpts());
        });
        list.appendChild(li);
      });
      container.appendChild(list);
    });

    /* Surprise me: pick a random catalogue entry. */
    const surprise = el("button", "picker-surprise", "surprise me");
    surprise.addEventListener("click", function () {
      onPick(Math.floor(Math.random() * entries.length), pickOpts());
    });
    container.appendChild(surprise);
  }

  return { render: render, savedOptions: savedOptions };
})();
