/* UI only: updates the two HUD counters — progress and clock. Nothing else;
   it never decides when time is up (the timer does) or ends the drill. */

window.SOM = window.SOM || {};

window.SOM.drillHud = (function () {
  function setup(progressEl, clockEl) {
    return {
      /* filledCount is how many cells hold a committed entry. */
      setProgress: function (filledCount, total) {
        progressEl.textContent = filledCount + "/" + total;
      },
      /* Render whole seconds as m:ss, e.g. 277 -> "4:37". */
      setClock: function (secondsLeft) {
        const minutes = Math.floor(secondsLeft / 60);
        const seconds = secondsLeft % 60;
        clockEl.textContent = minutes + ":" + String(seconds).padStart(2, "0");
      }
    };
  }

  return { setup: setup };
})();
