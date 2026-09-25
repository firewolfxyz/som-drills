/* Wiring only: render the stub grid, then connect key events to the entry
   controller. No rules, no generation, and no grading live here. */

window.SOM = window.SOM || {};

(function () {
  const rendered = window.SOM.drillView.render(
    document.getElementById("app"),
    window.SOM.stubSpec
  );
  window.SOM.entryView.setup(rendered.grid);
  const hud = window.SOM.drillHud.setup(rendered.progress, rendered.clock);
  hud.setClock(window.SOM.stubSpec.seconds);
  window.SOM.state.start(window.SOM.stubSpec, {
    view: window.SOM.entryView,
    hud: hud
  });

  /* Countdown from the spec's seconds; at zero entry stops so no key can act
     on anything any more (docs/ui.md "Timing"). Exposed for tools/ checks. */
  window.SOM.clock = window.SOM.timer.createTimer({
    seconds: window.SOM.stubSpec.seconds,
    onTick: function (secondsLeft) {
      hud.setClock(secondsLeft);
    },
    onExpire: function () {
      hud.setClock(0);
      window.SOM.state.stop();
    }
  });
  window.SOM.clock.start();

  document.addEventListener("keydown", function (event) {
    const mapped = window.SOM.keys.actionFor(event);
    if (mapped.action === "ignore") return;
    /* Acted-on keys must not reach the browser: Space must not scroll and
       Backspace must not navigate back in history. */
    event.preventDefault();
    window.SOM.state.handle(mapped.action, mapped.char);
  });
})();
