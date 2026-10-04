/* Session history (docs/phases.md): the best run per drill, persisted in
   localStorage so it survives reloads. Keyed by the drill's catalogue name.

   A "best" record is { correct, total, secondsLeft }. A new run beats the
   stored best when it has MORE correct cells, or the same count with MORE
   seconds left (faster). Score itself is never stored — it is derived at
   grade time and not displayed.

   localStorage may be unavailable (private mode, blocked origin); in that
   case this module degrades to an in-memory map for the life of the page so
   the drill itself never breaks. */

window.SOM = window.SOM || {};

window.SOM.history = (function () {
  const STORAGE_KEY = "som-history";

  /* Storage access with fallback: one probe at load, then a stable backend.
     The probe READS: a page view that records no run must not create a
     storage entry, and reads plus JSON.parse are exactly what readAll does
     later. A storage that only fails on write is caught by writeAll. */
  let memory = null; /* in-memory map used when localStorage is unusable */
  function storageUsable() {
    try {
      const raw = window.localStorage.getItem(STORAGE_KEY);
      if (raw !== null && raw !== "") JSON.parse(raw);
      return true;
    } catch (e) {
      memory = {};
      return false;
    }
  }

  function readAll() {
    try {
      const raw = window.localStorage.getItem(STORAGE_KEY);
      const parsed = raw ? JSON.parse(raw) : {};
      return (parsed && typeof parsed === "object") ? parsed : {};
    } catch (e) {
      if (memory === null) memory = {};
      return memory;
    }
  }

  function writeAll(map) {
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(map));
    } catch (e) {
      memory = map; /* storage just died: keep the latest state in memory */
    }
  }

  /* A run beats the stored best iff more correct, or tied with more time. */
  function beats(candidate, stored) {
    if (!stored) return true;
    if (candidate.correct !== stored.correct) {
      return candidate.correct > stored.correct;
    }
    return candidate.secondsLeft > stored.secondsLeft;
  }

  /* Best record for a drill name, or null when it has never been run. */
  function bestFor(name) {
    const map = readAll();
    const record = map[name];
    if (!record || typeof record.correct !== "number") return null;
    return {
      correct: record.correct,
      total: record.total,
      secondsLeft: record.secondsLeft
    };
  }

  /* Record a finished run. Returns { isBest, best } where best is the
     (possibly updated) stored record for the drill. */
  function record(name, correct, total, secondsLeft) {
    const map = readAll();
    const candidate = { correct: correct, total: total, secondsLeft: secondsLeft };
    const isBest = beats(candidate, map[name]);
    if (isBest) {
      map[name] = candidate;
      writeAll(map);
    }
    return { isBest: isBest, best: map[name] };
  }

  /* Wipe every stored record (used by tools and the reset control). */
  function clear() {
    if (memory !== null) { memory = {}; return; }
    try { window.localStorage.removeItem(STORAGE_KEY); } catch (e) { /* no-op */ }
  }

  storageUsable();

  return { bestFor: bestFor, record: record, clear: clear };
})();
