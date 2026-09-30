/* Work order for a drill grid (docs/model.md): column-major — top to bottom,
   then on to the next column. Index mapping: index = col * rowCount + row, so
   index % rowCount is the row and Math.floor(index / rowCount) is the column.

   Pure logic: no DOM access. Grading (Phase 3) lives here too, so the UI never
   computes correctness (docs/ui.md "Code layout for UI"). */

window.SOM = window.SOM || {};

window.SOM.rules = (function () {
  /* Next index down one row; from the last row of a column, the top of the next
     column; past the final cell, { done: true }. */
  function advance(index, rowCount, colCount) {
    const row = index % rowCount;
    const col = Math.floor(index / rowCount);
    if (row + 1 < rowCount) return index + 1;
    if (col + 1 < colCount) return (col + 1) * rowCount;
    return { done: true };
  }

  /* Previous index in work order: up a column, or the bottom of the previous
     column. Null at the very start — never before it. */
  function back(index, rowCount, colCount) {
    if (index <= 0) return null;
    const row = index % rowCount;
    const col = Math.floor(index / rowCount);
    if (row > 0) return index - 1;
    return col * rowCount - 1;
  }

  /* Total cells for a grid of these dimensions. */
  function cellCount(rowCount, colCount) {
    return rowCount * colCount;
  }

  /* Grade every cell in one pass (docs/phases.md Phase 3). texts is indexed by
     work-order index (index = col * rowCount + row); a null/empty entry grades
     as incorrect. A cell is correct iff its text equals the expected answer
     exactly. The expected answer is stringified first: operator modules emit
     numbers for + - x and strings for division ("3r2"), and typed text is
     always a string — no numeric re-parsing, so no wrong form can be
     accepted.

     score = correct cells + seconds remaining (phases.md Phase 3). */
  function grade(spec, texts, secondsLeft) {
    const rowCount = spec.rows.length;
    const results = new Array(rowCount * spec.cols.length);
    let correct = 0;
    for (let index = 0; index < results.length; index += 1) {
      const row = index % rowCount;
      const col = Math.floor(index / rowCount);
      const isCorrect = texts[index] === String(spec.answers[row][col]);
      results[index] = isCorrect;
      if (isCorrect) correct += 1;
    }
    return { results: results, correct: correct, score: correct + secondsLeft };
  }

  /* Session summary (docs/phases.md Phase 4), computed from the same inputs
     as grade():

     columns   - per-column accuracy: { correct, total } for each column,
                 in left-to-right order.
     missed    - work-order indices of every cell that was empty or wrong,
                 in work order (the cells to review).
     pace      - seconds per filled cell over the elapsed time (spec.seconds -
                 secondsLeft); null when nothing was filled, so the caller
                 never divides by zero.

     Pure logic: no DOM, no clock access — the caller passes the numbers. */
  function summarize(spec, texts, results, filled, secondsLeft) {
    const rowCount = spec.rows.length;
    const colCount = spec.cols.length;
    const columns = [];
    for (let col = 0; col < colCount; col += 1) {
      let correct = 0;
      for (let row = 0; row < rowCount; row += 1) {
        if (results[col * rowCount + row]) correct += 1;
      }
      columns.push({ correct: correct, total: rowCount });
    }
    const missed = [];
    for (let index = 0; index < results.length; index += 1) {
      if (!results[index]) missed.push(index);
    }
    const elapsed = spec.seconds - secondsLeft;
    const pace = filled > 0 ? elapsed / filled : null;
    return { columns: columns, missed: missed, pace: pace, filled: filled };
  }

  /* Compute-style entry (docs/model.md): the answer is typed from the RIGHT,
     digit by digit, exactly as it falls out of mental arithmetic — the final
     carry chunk stays in normal order at the end.

     singles = how many individual digits are written before the final chunk:
       add/subtract : max row digits - 1      (97+9=106 -> "610": write 6, then
                                                the chunk "10"; 58+7=65 -> "56")
       multiply     : leftDigits - 1          (338 x 5 = 1690 -> "0916": write
                                                0, 9, then the chunk "16";
                                                12 x 3 = 36 -> "63": write 6,
                                                then the chunk "3")

     computeEntry(answer, singles): reverse the last `singles` digits, keep
     the leading chunk in normal order. Leading zeros are preserved — that is
     the point of this mode.

     computeEntry("1690", 2) -> "0916"
     computeEntry("106",  1) -> "610"
     computeEntry("36",   1) -> "63"
     computeEntry("5",    1) -> "5"    (nothing left to reverse) */
  function computeEntry(answer, singles) {
    const s = String(answer);
    if (singles <= 0 || singles >= s.length) return s;
    /* The last `singles` digits are typed in reverse; the leading chunk is
       typed in normal order. */
    const tail = s.slice(-singles).split("").reverse().join("");
    return tail + s.slice(0, -singles);
  }

  /* Live display for compute entry: places each typed digit where it will
     finally sit in the answer, and reports where the NEXT digit goes.

     The first `singles` typed digits land right-to-left; the rest fill the
     leading chunk left-to-right. Untyped slots are spaces; pos is the index
     of the next slot (null once the buffer is complete).

     computeDisplay("1690", "09", 2) -> { text: "  90", pos: 0 }
     computeDisplay("1690", "091", 2) -> { text: "1 90", pos: 1 }
     computeDisplay("1690", "0916", 2) -> { text: "1690", pos: null } */
  function computeDisplay(answer, buffer, singles) {
    const s = String(answer);
    const L = s.length;
    const k = buffer.length;
    const chars = new Array(L).fill(" ");
    const nSingles = Math.min(k, singles);
    for (let i = 0; i < nSingles; i++) chars[L - 1 - i] = buffer[i];
    for (let i = nSingles; i < k; i++) chars[i - nSingles] = buffer[i];
    let pos;
    if (k >= L) pos = null; /* complete */
    else if (k < singles) pos = L - 1 - k;
    else pos = k - singles;
    return { text: chars.join(""), pos: pos };
  }

  /* The `singles` count for a whole drill spec; null for operators that do
     not use compute entry (division is always typed left to right). */
  function headLenFor(spec) {
    if (spec.operator === "add" || spec.operator === "subtract") {
      let max = 0;
      spec.rows.forEach(function (r) {
        const d = String(Math.abs(r)).length;
        if (d > max) max = d;
      });
      return Math.max(1, max - 1); /* only the last digit's sum is a chunk */
    }
    if (spec.operator === "multiply") {
      let leftMax = 0;
      spec.rows.forEach(function (r) {
        const d = String(Math.abs(r)).length;
        if (d > leftMax) leftMax = d;
      });
      return Math.max(1, leftMax - 1);
    }
    return null; /* divide: plain left-to-right entry */
  }

  return {
    advance: advance,
    back: back,
    cellCount: cellCount,
    grade: grade,
    summarize: summarize,
    computeEntry: computeEntry,
    computeDisplay: computeDisplay,
    headLenFor: headLenFor
  };
})();
