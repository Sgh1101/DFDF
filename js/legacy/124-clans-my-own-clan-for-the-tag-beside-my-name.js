(() => {
  // My own clan, for the [TAG] beside my name in a game: window.CLAN_ME = { id, tag, name } or null. Everyone else's tag is what
  // the host's server lookup said (api `levels`, js/legacy/109 tagOf); mine comes from the server too (api clan_mine, with my
  // token), when the page loads, when the owner's settings arrive and when the page comes back into view. A guest, a signed-out
  // visitor, a page with no server and a server with clans switched off have none.
  if ("undefined" == typeof window || !window.ACCOUNT || !ACCOUNT.api || !ACCOUNT.online) return;
  window.CLAN_ME = null;
  let busy = false,
    at = 0;
  const set = (v) => {
    const was = window.CLAN_ME && window.CLAN_ME.tag;
    window.CLAN_ME = v;
    // the lobby, the pre-match screen and the scoreboard read it again
    if ((v && v.tag) !== was)
      try {
        window.dispatchEvent(new CustomEvent("dfdf:levels"));
      } catch (e) {}
  };
  async function load(force) {
    const s = ACCOUNT.session();
    if (!s || !s.token || (s.user && s.user.guest)) return void set(null);
    if (busy || (!force && Date.now() - at < 30000)) return;
    busy = true;
    try {
      const j = await ACCOUNT.api("clan_mine", { token: s.token });
      set(j.clan && /^[A-Za-z0-9가-힣]{2,4}$/.test(String(j.clan.tag)) ? { id: j.clan.id, tag: String(j.clan.tag), name: String(j.clan.name || "") } : null);
    } catch (e) {}
    busy = false;
    at = Date.now();
  }
  addEventListener("server-config", () => load(true));
  document.addEventListener("visibilitychange", () => "visible" === document.visibilityState && load(false));
  window.CLAN_ME_RELOAD = () => load(true);
  load(true);
})();
