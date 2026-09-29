/* Wiring only: generate the grid spec from the catalogue, render it, then
   connect key events to the entry controller. No rules, no generation, and no
   grading live here (docs/ui.md "Code layout for UI").

   Reproducible runs for verification: add a seed to the URL fragment, e.g.
     index.html#seed=1234567890
   The same seed always yields the same start, columns and signs. With no seed
   the session uses Math.random. */

window.SOM = window.SOM || {};

(function () {
  /* Phase 2 has exactly one catalogue entry; the picker arrives later. */
  const entry = window.SOM.config.entries[0];
  const seed = window.SOM.random.parseSeed(
    (window.location.hash || "") + (window.location.search || "")
  );
  /* No seed in the URL: Math.random, exactly as an unseeded session should. */
  const spec = window.SOM.generate(entry, {
    rng: seed === null ? Math.random : window.SOM.random.seeded(seed)
  });

  const rendered = window.SOM.drillView.render(
    document.getElementById("app"),
    spec
  );
  window.SOM.entryView.setup(rendered.grid);
  const hud = window.SOM.drillHud.setup(rendered.progress, rendered.clock);
  hud.setClock(spec.seconds);
  window.SOM.state.start(spec, {
    view: window.SOM.entryView,
    hud: hud
  });

  /* Countdown from the spec's seconds; at zero entry stops so no key can act
     on anything any more (docs/ui.md "Timing"). Exposed for tools/ checks. */
  window.SOM.clock = window.SOM.timer.createTimer({
    seconds: spec.seconds,
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
