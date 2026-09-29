/* Wiring only: show the picker (one item per catalogue entry), then on a
   choice generate that drill's grid spec, render it, and connect key events
   to the entry controller. No rules, no generation, and no grading live here
   (docs/ui.md "Code layout for UI").

   URL fragments drive reproducible runs:
     index.html#drill=2#seed=1234567890
   #drill=<index> skips the picker and starts that catalogue entry directly;
   #seed=<int> makes the generation deterministic. Both can coexist (the seed
   parser scans arbitrary text). With no fragment the picker is shown and an
   unseeded session uses Math.random. */

window.SOM = window.SOM || {};

(function () {
  const app = document.getElementById("app");
  const fragment = (window.location.hash || "").replace(/^#/, "");

  function parseFragmentParam(name) {
    /* Fragments may carry several params ("drill=2&seed=1" style or repeated
       "#"); scan for "name=<integer>" and return it, else null. */
    const match = new RegExp(name + "=(\\d+)").exec(fragment);
    return match ? Number(match[1]) : null;
  }

  function startDrill(index) {
    const entry = window.SOM.config.entries[index];
    if (entry === undefined) return; /* out-of-range: ignore, stay on picker */
    const seed = window.SOM.random.parseSeed(fragment);
    const spec = window.SOM.generate(entry, {
      rng: seed === null ? Math.random : window.SOM.random.seeded(seed)
    });

    const rendered = window.SOM.drillView.render(app, spec);
    window.SOM.entryView.setup(rendered.grid);
    const hud = window.SOM.drillHud.setup(rendered.progress, rendered.clock);
    hud.setClock(spec.seconds);
    window.SOM.state.start(spec, {
      view: window.SOM.entryView,
      hud: hud,
      /* Phase 3 reveal: state hands the graded result to this view when the
         grid is complete or time runs out. */
      result: {
        show: function (result) {
          window.SOM.resultView.show(app, result);
        }
      },
      /* Time remaining at submit, read from the clock wired below. */
      secondsLeft: function () { return window.SOM.clock.secondsLeft(); }
    });

    /* Countdown from the spec's seconds; at zero the session submits whatever
       is filled in (docs/ui.md "Timing", phases.md Phase 3). Exposed for
       tools/ checks. */
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
  }

  /* The picker is the first screen; a #drill= fragment skips it. */
  const drillIndex = parseFragmentParam("drill");
  if (drillIndex !== null && window.SOM.config.entries[drillIndex] !== undefined) {
    startDrill(drillIndex);
  } else {
    window.SOM.pickerView.render(app, window.SOM.config.entries, startDrill);
  }

  document.addEventListener("keydown", function (event) {
    const mapped = window.SOM.keys.actionFor(event);
    if (mapped.action === "ignore") return;
    /* Acted-on keys must not reach the browser: Space must not scroll and
       Backspace must not navigate back in history. */
    event.preventDefault();
    window.SOM.state.handle(mapped.action, mapped.char);
  });
})();
