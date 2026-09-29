/* Entry controller: applies one mapped key action to the drill session and holds
   in-memory entry state (typed text per cell, filled flags, cursor) — docs/ui.md
   assigns "entries + cursor" to this module. It delegates work order to rules.js,
   key meaning to keys.js, DOM text/highlight to entryView, counter to drillHud,
   and the graded reveal to resultView (Phase 3). Grading itself lives in
   rules.js — this module only decides WHEN a session ends: grid complete or
   time up. */

window.SOM = window.SOM || {};

window.SOM.state = (function () {
  const MAX_CHARS = 6; /* cap typed length; extra digits are ignored */

  let spec, rowCount, colCount, total, typed, filledFlags, cursor, filled, done;
  let view, hud, resultView, secondsLeftFn, submitted, lastResult;
  let started = false; /* the picker screen runs before any session starts */

  function start(specArg, views) {
    spec = specArg;
    rowCount = spec.rows.length;
    colCount = spec.cols.length;
    total = window.SOM.rules.cellCount(rowCount, colCount);
    typed = new Array(total).fill(null);
    filledFlags = new Array(total).fill(false);
    view = views.view;
    hud = views.hud;
    resultView = views.result || null;
    secondsLeftFn = views.secondsLeft || function () { return 0; };
    filled = 0;
    done = false;
    submitted = false;
    lastResult = null;
    started = true;
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
      submit(); /* grid complete: grade everything and reveal */
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

  /* Time-up: end the session and submit whatever is filled in (phases.md
     Phase 3). The clock's remaining seconds are read through the getter passed
     at start, so this module never owns a timer. */
  function stop() {
    submit();
  }

  /* Grade every cell in one pass and hand the result to the result view.
     Idempotent: once submitted, every later key is refused and nothing is
     re-graded or re-revealed. */
  function submit() {
    if (submitted) return;
    submitted = true;
    done = true;
    const texts = typed.map(function (t) { return t === null ? "" : t; });
    const secondsLeft = secondsLeftFn();
    lastResult = window.SOM.rules.grade(spec, texts, secondsLeft);
    /* The result view renders from this object alone. */
    lastResult.spec = spec;
    lastResult.texts = texts;
    lastResult.secondsLeft = secondsLeft;
    lastResult.filled = filled;
    if (resultView) resultView.show(lastResult);
  }

  /* action/char come from keys.actionFor. Returns whether the key was acted on.
     Refused before start() so the always-on keydown listener is inert while
     the picker screen is showing. */
  function handle(action, char) {
    if (!started || done) return false;
    if (action === "digit") return onDigit(char);
    if (action === "commit") return onCommit();
    if (action === "back") return onBack();
    return false;
  }

  function info() {
    return {
      cursor: cursor,
      filled: filled,
      total: total,
      done: done,
      started: started,
      submitted: submitted,
      result: lastResult
    };
  }

  return { start: start, stop: stop, handle: handle, info: info };
})();
