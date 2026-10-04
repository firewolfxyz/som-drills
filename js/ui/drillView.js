/* UI only: renders the HUD and the drill grid from a spec. No rules, no
   generation, no keyboard handling (see docs/ui.md). */

window.SOM = window.SOM || {};

window.SOM.drillView = (function () {
  function el(tag, className, text) {
    const node = document.createElement(tag);
    if (className) node.className = className;
    if (text !== undefined) node.textContent = String(text);
    return node;
  }

  /* Returns the HUD elements entry wiring updates. The clock is deliberately
     NOT rendered here (operator request): time is hidden during the drill and
     only shown on the result screen (resultView). */
  function renderHud(container, spec) {
    const hud = el("header", "hud");
    /* Time progress bar: a thin track that shrinks as time runs out. It
       carries no numbers — the exact time is only shown on the result
       screen. Width is driven by drillHud.setTimeFraction. */
    const timeBar = el("div", "time-bar");
    timeBar.appendChild(el("div", "time-bar-fill"));
    hud.appendChild(timeBar);
    const row = el("div", "hud-row");
    row.appendChild(el("h1", "hud-name", spec.name));
    const progress = el(
      "div",
      "hud-progress",
      "0/" + spec.rows.length * spec.cols.length
    );
    row.appendChild(progress);
    hud.appendChild(row);
    container.appendChild(hud);
    return { progress: progress, timeBar: timeBar };
  }

  /* The shared row template: one fixed row-header track plus one flexible
     track per column (css/grid.css). Set on the grid so every row — header,
     data, and any footer — resolves the same columns. */
  function setColumns(gridEl, spec) {
    gridEl.style.setProperty("--cols", String(spec.cols.length));
  }

  /* Header row: corner cell, then one column header per column. */
  function renderHeaderRow(spec) {
    const row = el("div", "drill-row");
    row.appendChild(el("div", "cell corner"));
    spec.cols.forEach(function (col) {
      row.appendChild(el("div", "cell header num", col));
    });
    return row;
  }

  /* One row: row header, then one empty answer cell per column. */
  function renderDataRow(spec, rowIndex) {
    const row = el("div", "drill-row");
    row.appendChild(el("div", "cell rowhead num", spec.rows[rowIndex]));
    spec.cols.forEach(function (col, colIndex) {
      const cell = el("div", "cell answer");
      cell.dataset.row = String(rowIndex);
      cell.dataset.col = String(colIndex);
      row.appendChild(cell);
    });
    return row;
  }

  /* Returns the elements entry wiring needs: the grid and both HUD counters. */
  function render(container, spec) {
    container.innerHTML = "";
    const hudEls = renderHud(container, spec);

    const grid = el("div", "drill-grid");
    setColumns(grid, spec);
    grid.appendChild(renderHeaderRow(spec));
    spec.rows.forEach(function (row, rowIndex) {
      grid.appendChild(renderDataRow(spec, rowIndex));
    });

    container.appendChild(grid);
    return { grid: grid, progress: hudEls.progress, timeBar: hudEls.timeBar };
  }

  return { render: render };
})();
