/* Countdown helper: logic only, no DOM access (docs/ui.md puts the clock here,
   and a non-DOM module keeps it testable — tools/simulateEntry.js runs it under
   a shim with no timers at all).

   createTimer({ seconds, onTick, onExpire }) returns an object that counts down
   one second per tick. onTick(secondsLeft) fires after every tick; when the
   countdown reaches exactly zero it stops by itself and calls onExpire once.
   start() / stop() control the clock; tick() advances exactly one second and
   works with or without a scheduler, so tests never wait in real time. */

window.SOM = window.SOM || {};

window.SOM.timer = (function () {
  function createTimer(opts) {
    const seconds = opts.seconds;
    const onTick = opts.onTick || function () {};
    const onExpire = opts.onExpire || function () {};
    let remaining = seconds;
    let running = false;
    let timerId = null;

    function tick() {
      if (!running) return;
      remaining -= 1;
      onTick(remaining);
      if (remaining <= 0) {
        stop();
        onExpire();
      }
    }

    function start() {
      if (running || remaining <= 0) return; /* already running or expired */
      running = true;
      /* The shim in tools/simulateEntry.js has no setInterval: fall back to a
         manual tick() when no scheduler is available. */
      if (typeof setInterval === "function") {
        timerId = setInterval(tick, 1000);
      }
    }

    function stop() {
      running = false;
      if (timerId !== null && typeof clearInterval === "function") {
        clearInterval(timerId);
      }
      timerId = null;
    }

    return {
      start: start,
      stop: stop,
      tick: tick,
      secondsLeft: function () { return remaining; },
      isRunning: function () { return running; }
    };
  }

  return { createTimer: createTimer };
})();
