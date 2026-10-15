
// fighters are drawn and hit 10% bigger than the original 1.0 (eye 1.68 m -> 1.85 m)
window.BODY_K = 1.1;
// Not logged in on this tab yet: the homepage does the login and shows the
// level card, and its "enter" button brings you back here (with the room
// from an invite link, if there was one).
(() => {
  try {
    if (!/^https?:/.test(location.protocol)) return;
    const S = JSON.parse(localStorage.getItem("lgp_session") || "null"),
      g = sessionStorage.getItem("lgp_gate");
    if ((S && S.token && g === S.token) || "offline" === g) return;
    const q = new URLSearchParams(location.search),
      o = new URLSearchParams(),
      room = (q.get("room") || "").toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 6);
    room && o.set("room", room);
    "app" === q.get("source") && o.set("source", "app");
    window.__TO_HOME = !0;
    location.replace("./" + (o.toString() ? "?" + o : ""));
  } catch (e) {}
})();
