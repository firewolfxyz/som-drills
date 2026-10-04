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
  const keypadEl = document.getElementById("keypad");
  const fragment = (window.location.hash || "").replace(/^#/, "");

  function parseFragmentParam(name) {
    /* Fragments may carry several params ("drill=2&seed=1" style or repeated
       "#"); scan for "name=<integer>" and return it, else null. */
    const match = new RegExp(name + "=(\\d+)").exec(fragment);
    return match ? Number(match[1]) : null;
  }

  function startDrill(index, options) {
    const entry = window.SOM.config.entries[index];
    if (entry === undefined) return; /* out-of-range: ignore, stay on picker */
    const seed = window.SOM.random.parseSeed(fragment);
    const spec = window.SOM.generate(entry, {
      rng: seed === null ? Math.random : window.SOM.random.seeded(seed)
    });

    const rendered = window.SOM.drillView.render(app, spec);
    window.SOM.entryView.setup(rendered.grid);
    /* No numeric clock in the HUD: only a shrinking time bar (the exact
       time is shown on the result screen). */
    const hud = window.SOM.drillHud.setup(rendered.progress, null, rendered.timeBar);
    window.SOM.state.start(spec, {
      view: window.SOM.entryView,
      hud: hud,
      /* Phase 3 reveal: state hands the graded result to this view when the
         grid is complete or time runs out. The keypad is a drill-screen
         thing: hide it once the result is up. */
      result: {
        show: function (result) {
          /* The run is over: stop the countdown before revealing anything, so
             no tick touches the time bar the result screen has just replaced
             and the expiry handler cannot fire behind it. */
          window.SOM.clock.stop();
          /* Persist the run before revealing it; a new best earns a badge. */
          const stored = window.SOM.history.record(
            result.spec.name,
            result.correct,
            result.spec.rows.length * result.spec.cols.length,
            result.secondsLeft
          );
          result.newBest = stored.isBest;
          result.best = stored.best;
          window.SOM.resultView.show(app, result);
          window.SOM.keypadView.hide(keypadEl);
        }
      },
      /* Time remaining at submit, read from the clock wired below. */
      secondsLeft: function () { return window.SOM.clock.secondsLeft(); }
    }, options);

    /* Countdown from the spec's seconds; at zero the session submits whatever
       is filled in (docs/ui.md "Timing", phases.md Phase 3). Exposed for
       tools/ checks. */
    window.SOM.clock = window.SOM.timer.createTimer({
      seconds: spec.seconds,
      onTick: function (secondsLeft) {
        hud.setTimeFraction(secondsLeft / spec.seconds);
      },
      onExpire: function () {
        window.SOM.state.stop();
      }
    });
    window.SOM.clock.start();

    /* Touch entry (Phase 5): the keypad is a drill-screen control. */
    if (touchDevice) window.SOM.keypadView.show(keypadEl);
  }

  /* Touch entry (Phase 5): render the on-screen keypad only for coarse
     pointers / touch devices; keyboard-only screens never see it. Taps map
     to the same actions as keys and go through state.handle, which is inert
     while the picker shows or after submit. */
  const touchDevice = (window.matchMedia &&
      window.matchMedia("(pointer: coarse)").matches) ||
    ("ontouchstart" in window);
  if (touchDevice) {
    window.SOM.keypadView.render(keypadEl, function (action, char) {
      window.SOM.state.handle(action, char);
    });
  }

  /* The picker is the first screen; a #drill= fragment skips it — but the
     entry-mode and auto-advance choices still come from the picker's saved
     settings, so a fragment link starts the same kind of session. */
  const drillIndex = parseFragmentParam("drill");
  if (drillIndex !== null && window.SOM.config.entries[drillIndex] !== undefined) {
    startDrill(drillIndex, window.SOM.pickerView.savedOptions());
  } else {
    window.SOM.pickerView.render(app, window.SOM.config.entries, startDrill);
  }

  document.addEventListener("keydown", function (event) {
    const mapped = window.SOM.keys.actionFor(event);
    if (mapped.action === "ignore") return;
    /* Only keys the session acts on are swallowed: Space must not scroll and
       Backspace must not navigate back. Keys the session refuses (picker
       screen, after submit) pass through, so Enter/Space can activate a
       focused picker button and the result-screen link. */
    const acted = window.SOM.state.handle(mapped.action, mapped.char);
    if (acted) event.preventDefault();
  });
})();
