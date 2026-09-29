/* UI only: updates the HUD counters — progress, and the clock when one is
   rendered (it is not during the drill; time is only shown on the result
   screen). It never decides when time is up (the timer does) or ends the
   drill. */

window.SOM = window.SOM || {};

window.SOM.drillHud = (function () {
  function setup(progressEl, clockEl) {
    return {
      /* filledCount is how many cells hold a committed entry. */
      setProgress: function (filledCount, total) {
        progressEl.textContent = filledCount + "/" + total;
      },
      /* Render whole seconds as m:ss, e.g. 277 -> "4:37". No-op when no
         clock element was rendered (the drill HUD hides time). */
      setClock: function (secondsLeft) {
        if (!clockEl) return;
        const minutes = Math.floor(secondsLeft / 60);
        const seconds = secondsLeft % 60;
        clockEl.textContent = minutes + ":" + String(seconds).padStart(2, "0");
      }
    };
  }

  return { setup: setup };
})();
