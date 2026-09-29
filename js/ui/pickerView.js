/* UI only: the drill picker (docs/ui.md "Screens" 1). Renders one item per
   catalogue entry and reports a click as an index. It lists configs; it
   contains no rules, no generation, and no session logic — main.js decides
   what a chosen index means. */

window.SOM = window.SOM || {};

window.SOM.pickerView = (function () {
  function el(tag, className, text) {
    const node = document.createElement(tag);
    if (className) node.className = className;
    if (text !== undefined) node.textContent = String(text);
    return node;
  }

  /* Renders the list into container. onPick(index) fires when an item is
     clicked; each item also carries data-index for tools/ checks. */
  function render(container, entries, onPick) {
    container.innerHTML = "";
    container.appendChild(el("h1", "app-title", "som driller"));
    container.appendChild(el("h2", "picker-title", "choose a drill"));

    const list = el("ul", "picker-list");
    entries.forEach(function (entry, index) {
      const item = el("li", "picker-item");
      item.dataset.index = String(index);
      item.appendChild(el("button", "picker-button", entry.name));
      item.querySelector("button").addEventListener("click", function () {
        onPick(index);
      });
      list.appendChild(item);
    });
    container.appendChild(list);
  }

  return { render: render };
})();
