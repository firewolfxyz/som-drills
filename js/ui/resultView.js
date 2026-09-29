/* UI only: the reveal screen (docs/ui.md "Screens" 3). Renders the graded
   grid — every answer cell marked correct/incorrect, a footer row with each
   column's correct count, plus the session summary (correct count, time
   remaining; missed cells, pace per docs/phases.md Phase 4) and a
   back-to-drills link.

   It displays results; it computes none of them. The per-cell booleans come
   from rules.grade and the summary from rules.summarize, both via state.js,
   which is why spec.answers is never read here. Re-rendering replaces the
   whole #app container, so the drill grid and HUD are gone by construction —
   no feedback can leak back into entry. */

window.SOM = window.SOM || {};

window.SOM.resultView = (function () {
  function el(tag, className, text) {
    const node = document.createElement(tag);
    if (className) node.className = className;
    if (text !== undefined) node.textContent = String(text);
    return node;
  }

  /* result: { spec, results[] (per work-order index), correct, score, filled,
     secondsLeft, summary { columns[], missed[], pace, filled } } — produced
     by rules.grade + rules.summarize via state.submit. */
  function show(container, result) {
    const spec = result.spec;
    const rowCount = spec.rows.length;

    container.innerHTML = "";
    container.appendChild(el("h1", "result-title", spec.name));

    /* Time remaining. The correct count is already visible in the grid
       footer (per-column), so it is not repeated here. */
    const summary = el("div", "result-summary");
    summary.appendChild(el("span", "result-stat", result.secondsLeft + "s left"));
    container.appendChild(summary);

    /* Session summary: missed cells and pace (per-column correct counts
       live in the grid footer row, one under each column). */
    renderSessionSummary(container, result);

    /* Graded grid: same shape as the drill, each cell carrying its verdict.
       Same row template as drillView (--cols from the spec) so the footer
       stats line up under their columns. */
    const grid = el("div", "drill-grid");
    grid.style.setProperty("--cols", String(spec.cols.length));
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

    /* Footer row: under the last number of each column, that column's
       correct count (c/t). */
    const footer = el("div", "drill-row");
    footer.appendChild(el("div", "cell corner"));
    spec.cols.forEach(function (col, colIndex) {
      const stat = result.summary.columns[colIndex];
      footer.appendChild(
        el("div", "cell colstat", stat.correct + "/" + stat.total)
      );
    });
    grid.appendChild(footer);

    container.appendChild(grid);

    /* Back to the picker: a plain reload. No navigation code, no history. */
    const back = el("a", "result-back", "back to drills");
    back.href = "";
    container.appendChild(back);
  }

  /* The missed work-order indices as row/col pairs in work order, and pace
     in seconds per filled cell. Per-column correct counts are rendered as a
     footer row of the graded grid (one stat under each column). */
  function renderSessionSummary(container, result) {
    const spec = result.spec;
    const rowCount = spec.rows.length;
    const summary = result.summary;

    const block = el("div", "session-summary");
    block.appendChild(el("h2", "session-title", "summary"));

    /* Missed cells read as row/col so they can be found on the grid above. */
    const missedText = summary.missed.length === 0
      ? "none"
      : summary.missed.map(function (index) {
          return "r" + (index % rowCount + 1) + "c" + (Math.floor(index / rowCount) + 1);
        }).join(", ");
    block.appendChild(el("div", "session-missed", "missed: " + missedText));

    const paceText = summary.pace === null
      ? "no cells filled"
      : summary.pace.toFixed(1) + "s per cell";
    block.appendChild(el("div", "session-pace", "pace: " + paceText));

    container.appendChild(block);
  }

  return { show: show };
})();
