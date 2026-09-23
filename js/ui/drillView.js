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

  function renderHud(container, spec) {
    const hud = el("header", "hud");
    hud.appendChild(el("h1", "hud-name", spec.name));
    hud.appendChild(el("div", "hud-clock", "5:00"));
    hud.appendChild(
      el("div", "hud-progress", "0/" + spec.rows.length * spec.cols.length)
    );
    container.appendChild(hud);
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

  function render(container, spec) {
    container.innerHTML = "";
    renderHud(container, spec);

    const grid = el("div", "drill-grid");
    grid.appendChild(renderHeaderRow(spec));
    spec.rows.forEach(function (row, rowIndex) {
      grid.appendChild(renderDataRow(spec, rowIndex));
    });

    container.appendChild(grid);
    return grid;
  }

  return { render: render };
})();
