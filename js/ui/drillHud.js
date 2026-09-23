/* UI only: updates the progress counter in the HUD. Nothing else — step 3 owns
   the clock element, so this file must never touch it. */

window.SOM = window.SOM || {};

window.SOM.drillHud = (function () {
  function setup(progressEl) {
    return {
      /* filledCount is how many cells hold a committed entry. */
      setProgress: function (filledCount, total) {
        progressEl.textContent = filledCount + "/" + total;
      }
    };
  }

  return { setup: setup };
})();
