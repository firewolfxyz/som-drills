/* UI only: the Phase 3 reveal screen (docs/ui.md "Screens" 3). Renders the
   graded grid — every answer cell marked correct/incorrect — plus a summary
   (correct count, time remaining, score) and a back-to-drills link.

   It displays results; it computes none of them. The per-cell booleans come
   from rules.grade via state.js, which is why spec.answers is never read here.
   Re-rendering replaces the whole #app container, so the drill grid and HUD
   are gone by construction — no feedback can leak back into entry. */

window.SOM = window.SOM || {};

window.SOM.resultView = (function () {
  function el(tag, className, text) {
    const node = document.createElement(tag);
    if (className) node.className = className;
    if (text !== undefined) node.textContent = String(text);
    return node;
  }

  /* result: { spec, results[] (per work-order index), correct, score, filled,
     secondsLeft } — produced by rules.grade + state.submit. */
  function show(container, result) {
    const spec = result.spec;
    const rowCount = spec.rows.length;

    container.innerHTML = "";
    container.appendChild(el("h1", "result-title", spec.name));

    /* Summary: correct cells, time left, score (= correct + seconds left). */
    const summary = el("div", "result-summary");
    summary.appendChild(
      el("span", "result-stat", result.correct + "/" + (rowCount * spec.cols.length) + " correct")
    );
    summary.appendChild(el("span", "result-stat", result.secondsLeft + "s left"));
    summary.appendChild(el("span", "result-score", "score " + result.score));
    container.appendChild(summary);

    /* Graded grid: same shape as the drill, each cell carrying its verdict. */
    const grid = el("div", "drill-grid");
    const headerRow = el("div", "drill-row");
    headerRow.appendChild(el("div", "cell corner"));
    spec.cols.forEach(function (col) {
      headerRow.appendChild(el("div", "cell header num", col));
    });
    grid.appendChild(headerRow);

    spec.rows.forEach(function (row, rowIndex) {
      const rowEl = el("div", "drill-row");
      rowEl.appendChild(el("div", "cell rowhead num", row));
      spec.cols.forEach(function (col, colIndex) {
        const index = colIndex * rowCount + rowIndex;
        const cell = el(
          "div",
          "cell answer graded " + (result.results[index] ? "is-correct" : "is-incorrect"),
          result.texts[index] === "" ? "\u2014" : result.texts[index]
        );
        cell.dataset.row = String(rowIndex);
        cell.dataset.col = String(colIndex);
        rowEl.appendChild(cell);
      });
      grid.appendChild(rowEl);
    });
    container.appendChild(grid);

    /* Back to the picker: a plain reload. No navigation code, no history. */
    const back = el("a", "result-back", "back to drills");
    back.href = "";
    container.appendChild(back);
  }

  return { show: show };
})();
