/* Entry controller: applies one mapped key action to the drill session and holds
   in-memory entry state (typed text per cell, filled flags, cursor) — docs/ui.md
   assigns "entries + cursor" to this module. It delegates work order to rules.js,
   key meaning to keys.js, DOM text/highlight to entryView, counter to drillHud.
   Answers are never consulted here; grading is Phase 3. */

window.SOM = window.SOM || {};

window.SOM.state = (function () {
  const MAX_CHARS = 6; /* cap typed length; extra digits are ignored */

  let rowCount, colCount, total, typed, filledFlags, cursor, filled, done;
  let view, hud;

  function start(spec, views) {
    rowCount = spec.rows.length;
    colCount = spec.cols.length;
    total = window.SOM.rules.cellCount(rowCount, colCount);
    typed = new Array(total).fill(null);
    filledFlags = new Array(total).fill(false);
    view = views.view;
    hud = views.hud;
    filled = 0;
    done = false;
    cursor = 0;
    view.highlight(cursor);
    updateHud();
  }

  function updateHud() {
    hud.setProgress(filled, total);
  }

  function currentText() {
    return typed[cursor] === null ? "" : typed[cursor];
  }

  function showCurrent() {
    view.showText(cursor, currentText());
  }

  function onDigit(char) {
    if (currentText().length >= MAX_CHARS) return true;
    typed[cursor] = currentText() + char;
    showCurrent();
    return true;
  }

  function onCommit() {
    /* An empty commit does nothing: it must never create a blank ahead. */
    if (currentText() === "") return true;
    filledFlags[cursor] = true;
    filled += 1;
    updateHud();
    const next = window.SOM.rules.advance(cursor, rowCount, colCount);
    if (next.done) {
      done = true; /* grid complete: entry stops, nothing is graded here */
      return true;
    }
    cursor = next;
    view.highlight(cursor);
    typed[cursor] = null; /* fresh cell starts empty */
    view.clearCell(cursor);
    return true;
  }

  function onBack() {
    if (currentText().length > 0) {
      /* Mid-entry: remove one character only. */
      typed[cursor] = currentText().slice(0, -1);
      showCurrent();
      return true;
    }
    const previous = window.SOM.rules.back(cursor, rowCount, colCount);
    if (previous === null) return true; /* already at the start */
    cursor = previous;
    view.highlight(cursor);
    if (filledFlags[cursor]) {
      filled -= 1;
      filledFlags[cursor] = false;
      updateHud();
    }
    showCurrent(); /* restore the saved text so it can be edited again */
    return true;
  }

  /* action/char come from keys.actionFor. Returns whether the key was acted on. */
  function handle(action, char) {
    if (done) return false;
    if (action === "digit") return onDigit(char);
    if (action === "commit") return onCommit();
    if (action === "back") return onBack();
    return false;
  }

  function info() {
    return { cursor: cursor, filled: filled, total: total, done: done };
  }

  return { start: start, handle: handle, info: info };
})();
