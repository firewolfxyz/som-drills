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

  let spec, rowCount, colCount, total, typed, filledFlags, negFlags, cursor, filled, done;
  let view, hud, resultView, secondsLeftFn, submitted, lastResult;
  /* Entry modes (picker toggle):
       ltr     - default: digits append left to right.
       rtl     - each typed digit lands on the LEFT of what is in the cell,
                 so the first digit typed ends up rightmost.
       compute - mental-math order: type the answer from the right, the final
                 carry chunk last in normal order (338 x 5 -> type 0916).
                 When the buffer matches the cell's computed entry string the
                 cell displays the REAL answer and advances automatically.
                 Division drills have no compute mode (headLen null) and fall
                 back to plain left-to-right. */
  let mode = "ltr";
  let headLen = 0;
  let auto = false; /* commit a cell as soon as it holds as many characters
                       as its answer (no Enter needed) */
  let started = false; /* the picker screen runs before any session starts */

  function start(specArg, views, opts) {
    spec = specArg;
    headLen = window.SOM.rules.headLenFor(specArg);
    const o = opts || {};
    if (o.rtl) {
      mode = "rtl";
    } else if (o.compute && headLen !== null) {
      mode = "compute";
    } else {
      mode = "ltr"; /* division in compute mode falls back to plain ltr */
    }
    auto = !!o.auto;
    rowCount = spec.rows.length;
    colCount = spec.cols.length;
    total = window.SOM.rules.cellCount(rowCount, colCount);
    typed = new Array(total).fill(null);
    filledFlags = new Array(total).fill(false);
    negFlags = new Array(total).fill(false);
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
    showCurrent(); /* compute mode shows the entry cursor in the first cell */
    updateHud();
  }

  function updateHud() {
    hud.setProgress(filled, total);
  }

  function currentText() {
    return typed[cursor] === null ? "" : typed[cursor];
  }

  /* Live cell content. In compute mode the typed buffer is laid out at its
     FINAL digit positions and a cursor sits UNDER the next digit place;
     the stored text is only ever the real answer (set on auto-advance). */
  function renderCell(index) {
    const t = typed[index];
    if (mode !== "compute") {
      view.showText(index, t === null ? "" : t);
      return;
    }
    const answer = String(spec.answers[index % rowCount][Math.floor(index / rowCount)]);
    /* A correct cell stores the REAL answer and shows it as-is. */
    if (t !== null && t === answer) {
      view.showText(index, t);
      return;
    }
    /* Everything else — a partial buffer, a committed wrong entry — keeps the
       same positional layout: each typed digit holds the place it occupies in
       the answer, so nothing jumps when the buffer fills up or commits. Only
       the DISPLAY is laid out; the stored text stays the typed order. */
    const d = window.SOM.rules.computeDisplay(answer, t === null ? "" : t, headLen, negFlags[index]);
    const slots = [];
    for (let i = 0; i < d.text.length; i++) {
      slots.push({ ch: d.text[i] || " ", next: d.pos === i });
    }
    view.showSlots(index, slots);
  }

  function showCurrent() {
    renderCell(cursor);
  }

  /* Length of this cell's expected answer, including a sign for negative
     answers. Only read for the auto-advance option — never for grading. */
  function answerLength(index) {
    return String(spec.answers[index % rowCount][Math.floor(index / rowCount)]).length;
  }

  function onDigit(char) {
    if (currentText().length >= MAX_CHARS) return true;
    if (mode === "compute") {
      /* Digits append in mental-math order. The buffer is stored as typed
         and displayed at its final positions with a cursor; when it equals
         this cell's computed entry string the REAL answer is stored and the
         cell advances automatically (no Enter needed). */
      const buffer = currentText() + char;
      const rawAnswer = String(spec.answers[cursor % rowCount][Math.floor(cursor / rowCount)]);
      const absAnswer = String(Math.abs(Number(rawAnswer)));
      if (buffer === window.SOM.rules.computeEntry(absAnswer, headLen)) {
        typed[cursor] = negFlags[cursor] ? "-" + absAnswer : absAnswer;
        showCurrent();
        onCommit();
      } else if (auto && buffer.length >= absAnswer.length) {
        /* Auto-advance: a full-length WRONG buffer commits as typed and
           advances — never stranded, and it reveals nothing about whether
           the digits are right, only how long the answer is. */
        typed[cursor] = buffer;
        showCurrent();
        onCommit();
      } else {
        typed[cursor] = buffer;
        showCurrent();
      }
      return true;
    }
    /* Left-to-right: the digit appends. Right-to-left: it lands on the left,
       so the first digit typed sits rightmost in the cell. */
    typed[cursor] = mode === "rtl" ? char + currentText() : currentText() + char;
    showCurrent();
    /* Auto-advance: a cell that holds at least as many characters as its
       answer commits itself, no Enter needed. "At least" (not "exactly") so
       a wrong-length entry still advances instead of stranding the cursor —
       and it never reveals whether the digits are right, only how long the
       answer is. */
    if (auto && currentText().length >= answerLength(cursor)) onCommit();
    return true;
  }

  function onCommit() {
    /* An empty commit does nothing: it must never create a blank ahead. */
    if (currentText() === "") return true;
    const previous = cursor;
    filledFlags[cursor] = true;
    filled += 1;
    updateHud();
    /* Re-render the cell being left: its stored text changed (the real answer
       on a correct entry) and its layout no longer carries a cursor. */
    if (mode === "compute") renderCell(previous);
    const next = window.SOM.rules.advance(cursor, rowCount, colCount);
    if (next.done) {
      submit(); /* grid complete: grade everything and reveal */
      return true;
    }
    cursor = next;
    view.highlight(cursor);
    typed[cursor] = null; /* fresh cell starts empty */
    showCurrent(); /* compute mode shows the entry cursor in a fresh cell */
    return true;
  }

  function onBack() {
    if (mode === "compute" && negFlags[cursor] && currentText() === "") {
      /* Empty cell with sign toggled: un-toggle the sign first. */
      negFlags[cursor] = false;
      showCurrent();
      return true;
    }
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
    /* Compute mode: a completed cell stores the REAL answer; reopening it
       for editing means restoring its typed buffer. */
    if (mode === "compute") {
      const t = typed[previous];
      const answer = String(spec.answers[previous % rowCount][Math.floor(previous / rowCount)]);
      if (t !== null && t === answer) {
        negFlags[previous] = answer.charAt(0) === "-";
        typed[previous] = window.SOM.rules.computeEntry(String(Math.abs(Number(answer))), headLen);
      }
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
    /* Phase 4 session summary: per-column accuracy, missed cells, pace. */
    lastResult.summary = window.SOM.rules.summarize(
      spec, texts, lastResult.results, filled, secondsLeft
    );
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
    if (action === "minus") {
      if (mode === "compute") {
        negFlags[cursor] = !negFlags[cursor];
      } else {
        /* Plain modes: toggle a "-" prefix in the typed text. */
        const t = currentText();
        typed[cursor] = t.charAt(0) === "-"
          ? t.slice(1)
          : "-" + t;
      }
      showCurrent();
      return true;
    }
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
