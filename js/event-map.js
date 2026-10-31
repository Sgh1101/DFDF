(function (root) {
  // The event map: 사막 마을 (Desert Town, the Kour.io map7). Unlike the map of the week it is one fixed map; it is open while
  // the owner's switch is on and until a last day (YYYYMMDD, Korea time, that day included; empty = no end). The server
  // announces it in the public config (eventMap) and the page checks the same day itself, so it goes by itself after that day.
  const KST = 9 * 36e5, DAY = 864e5, KEY = "desert_town";
  const valid = (s) => {
    if (!/^\d{8}$/.test(s)) return false;
    const y = +s.slice(0, 4), m = +s.slice(4, 6), d = +s.slice(6, 8), t = new Date(Date.UTC(y, m - 1, d));
    return y >= 2020 && t.getUTCFullYear() === y && t.getUTCMonth() === m - 1 && t.getUTCDate() === d;
  };
  // the ms at which the last day is over (the next 0:00 in Korea), 0 when there is no (valid) last day
  const endOf = (last) => { const s = String(last == null ? "" : last).trim(); return valid(s) ? Date.UTC(+s.slice(0, 4), +s.slice(4, 6) - 1, +s.slice(6, 8)) - KST + DAY : 0; };
  // the event for a time: { key, last, until } or null when it is switched off or its last day is over
  function choose(t, on, last) {
    if (!on) return null;
    const until = endOf(last);
    if (until && t >= until) return null;
    return { key: KEY, last: until ? String(last).trim() : "", until };
  }
  const open = (e, t) => !!(e && e.key && (!e.until || t < e.until));
  const API = { KEY, valid, endOf, choose, open };
  if (typeof module === "object" && module.exports) module.exports = API;
  else root.EVENT_MAP = API;
})(typeof window === "object" ? window : globalThis);
