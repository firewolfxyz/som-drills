/* Work order for a drill grid (docs/model.md): column-major — top to bottom,
   then on to the next column. Index mapping: index = col * rowCount + row, so
   index % rowCount is the row and Math.floor(index / rowCount) is the column.

   Pure logic: no DOM access and no knowledge of the spec object beyond its two
   dimensions. Grading arrives in Phase 3 as separate functions here. */

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

  return { advance: advance, back: back, cellCount: cellCount };
})();
