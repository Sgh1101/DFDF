(function (root) {
  // The map of the week: every Monday 0:00 (Korea) one of the maps that are switched off joins the normal list for the
  // week, the same for everyone. The week is a number (Mondays since 1970); the maps are taken in turn in an order that
  // is shuffled again every time the whole list has been through, so a map does not come back before the others, and
  // the same week gives the same map on every computer and on the server.
  const KST = 9 * 36e5, DAY = 864e5;
  // the maps that wait outside the list (js/legacy/76 POOL has the rest): four older 5v5 maps, the 30 generated ones,
  // a 3v3 and a duel map. The ones that were found not to work are not here (tests/map-week.test.js and
  // scripts/browser-map-week.js check every one).
  const CANDIDATES = ["harbor", "freighter", "temple", "forge"].concat(Array.from({ length: 30 }, (_, i) => "g" + String(i + 1).padStart(2, "0")), ["s01", "d02"]);
  // the number of the week the time is in: Monday 0:00 in Korea starts week n (1970-01-05 was the first Monday)
  const weekOf = (t) => Math.floor((Math.floor((t + KST) / DAY) + 3) / 7);
  // when the week starts and ends (ms)
  const startOf = (w) => (7 * w - 3) * DAY - KST;
  const rng = (seed) => {
    let a = seed >>> 0;
    return () => {
      a = (a + 0x6d2b79f5) >>> 0;
      let t = a;
      t = Math.imul(t ^ (t >>> 15), t | 1);
      t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  };
  const order = (list, cycle) => {
    const out = list.slice(), r = rng(Math.imul(cycle + 1, 2654435761) ^ 0x9e3779b9);
    for (let i = out.length - 1; i > 0; i--) { const j = Math.floor(r() * (i + 1)); [out[i], out[j]] = [out[j], out[i]]; }
    return out;
  };
  // the map of week w from `list` (keys): the n-th in the order of its round
  function pick(w, list) {
    const n = list.length;
    if (!n) return null;
    const cycle = Math.floor(w / n), pos = w - cycle * n, cur = order(list, cycle);
    // the first of a round is not the last of the one before
    if (n > 1 && cycle > 0 && order(list, cycle - 1)[n - 1] === cur[0]) [cur[0], cur[1]] = [cur[1], cur[0]];
    return cur[pos];
  }
  const keys = (s) => String(s || "").split(/[\s,]+/).filter(Boolean);
  // the choice for a time: { key, week, from, until } or null when it is switched off or nothing is left
  // (`on`: the owner's switch, `exclude`: the owner's list of keys, `ok`: keys that must not be picked, a list)
  function choose(t, on, exclude, ok) {
    if (!on) return null;
    const out = new Set(keys(exclude)), w = weekOf(t);
    const list = CANDIDATES.filter((k) => !out.has(k) && (!ok || ok.includes(k)));
    const key = pick(w, list);
    return key ? { key, week: w, from: startOf(w), until: startOf(w + 1) } : null;
  }
  const API = { CANDIDATES, weekOf, startOf, pick, choose, keys };
  if (typeof module === "object" && module.exports) module.exports = API;
  else root.MAP_WEEK = API;
})(typeof window === "object" ? window : globalThis);
