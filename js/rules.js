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

  return { advance: advance, back: back, cellCount: cellCount, grade: grade };
})();
