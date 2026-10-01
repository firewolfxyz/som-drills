/* UI only: presentation state for entry. Highlights exactly one cell, writes
   echo text into a cell, clears a cell. Builds its own index -> element lookup
   from the cells drillView rendered (data-row / data-col).

   It does not decide work order (rules.js does), handle keys (keys.js does), or
   know any answer — spec.answers is never read anywhere during entry. */

window.SOM = window.SOM || {};

window.SOM.entryView = (function () {
  let cells = []; /* index -> element, index = col * rowCount + row */

  function setup(gridEl) {
    const found = Array.prototype.slice.call(
      gridEl.querySelectorAll(".cell.answer")
    );
    let rowCount = 0;
    found.forEach(function (cell) { rowCount = Math.max(rowCount, Number(cell.dataset.row) + 1); });
    cells = new Array(found.length);
    found.forEach(function (cell) {
      const index = Number(cell.dataset.col) * rowCount + Number(cell.dataset.row);
      cells[index] = cell;
    });
    return cells.length;
  }

  function cellAt(index) {
    return cells[index] || null;
  }

  /* Move the highlight so exactly one cell is active. */
  function highlight(index) {
    cells.forEach(function (cell, i) {
      cell.classList.toggle("is-active", i === index);
    });
  }

  function showText(index, text) {
    cellAt(index).textContent = text;
  }

  /* Compute mode: render each digit as its own slot span; the next (empty)
     slot gets .slot-next for the gold background highlight. */
  function showSlots(index, slots) {
    const cell = cellAt(index);
    cell.textContent = ""; /* replaces any children */
    slots.forEach(function (s) {
      const span = document.createElement("span");
      span.className = s.next ? "slot slot-next" : "slot";
      span.textContent = s.ch;
      cell.appendChild(span);
    });
  }

  function clearCell(index) {
    showText(index, "");
  }

  return {
    setup: setup,
    cellAt: cellAt,
    highlight: highlight,
    showText: showText,
    showSlots: showSlots,
    clearCell: clearCell
  };
})();
