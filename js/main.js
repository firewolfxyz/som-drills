/* Wiring only: take the stub spec, ask drillView to render it. */

window.SOM = window.SOM || {};

(function () {
  const container = document.getElementById("app");
  window.SOM.drillView.render(container, window.SOM.stubSpec);
})();
