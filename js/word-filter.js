(function (root) {
  // The swear-word filter: the chat (js/legacy/115) masks what it relays, and the server (api/v1.js, clan names, tags and
  // descriptions) refuses a text that the filter would change. Swear words, Korean and English, also with a space or a mark
  // between the letters and in the initial-sound form (ㅅㅂ, ㅂㅅ …): each becomes ***. Words that are also plain words
  // (보지, 자지, ass …) are left out on purpose.
  const GAP = "[\\s._\\-*~!@#$%^&+=|/\\\\,:;'\"`]{0,2}",
    esc = (c) => c.replace(/[.*+?^${}()|[\]\\\/-]/g, "\\$&"),
    spread = (w, gap) => Array.from(w).map(esc).join(gap);
  const KO = ["시발", "씨발", "씨팔", "시팔", "씨빨", "시빨", "쉬발", "병신", "븅신", "빙신", "개새끼", "새끼야", "쌔끼", "지랄", "좆", "존나", "씹새", "씹년", "느금", "니미", "엿먹", "미친년", "미친놈", "썅", "염병", "창녀", "씨부랄", "애미", "앰창", "엠창"],
    JAMO = ["ㅅㅂ", "ㅆㅂ", "ㅂㅅ", "ㅄ", "ㅈㄹ", "ㅁㅊ"],
    ENW = ["fuck", "shit", "bitch", "asshole", "cunt", "bastard", "whore", "slut", "nigger", "nigga", "faggot", "retard", "pussy"];
  const RE_KO = new RegExp([...KO, ...JAMO].map((w) => spread(w, GAP)).join("|"), "g"),
    // an English word starts at a word edge (no lookbehind: older Safari) and may go on (fucking, shitty)
    RE_EN = new RegExp("(^|[^a-z])(" + ENW.map((w) => spread(w, "[^a-z0-9]{0,2}")).join("|") + ")", "gi");
  const mask = (s) => String(s).replace(RE_KO, "***").replace(RE_EN, (m, p) => p + "***");
  // does the text hold a swear word?
  const has = (s) => mask(s) !== String(s);
  const API = { mask, has };
  if (typeof module === "object" && module.exports) module.exports = API;
  else root.WORD_FILTER = API;
})(typeof window === "object" ? window : globalThis);
