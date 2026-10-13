
// Before anything else: a room link joins once the page has finished loading
// (the game's own join started during loading and could run out of time on a
// slow device), or right after the login when this visit still needs one.
(() => {
  try {
    if (window.__TO_HOME) return; // the homepage keeps the room for after the login
    const q = new URLSearchParams(location.search),
      code = (q.get("room") || "").toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 6);
    if (6 !== code.length) return;
    q.delete("room");
    history.replaceState(null, "", location.pathname + (q.toString() ? "?" + q : "") + location.hash);
    window.__PENDING_ROOM = code;
  } catch (e) {}
})();
