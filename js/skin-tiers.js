// Weapon-skin tiers, shared by the game, account API and owner page.
(function (root) {
  const list = Object.freeze([
    { id: 1, key: "common", ko: "일반", en: "Common", c: "#4ade80" },
    { id: 2, key: "rare", ko: "희귀", en: "Rare", c: "#38bdf8" },
    { id: 3, key: "epic", ko: "영웅", en: "Epic", c: "#c084fc" },
    { id: 4, key: "legendary", ko: "전설", en: "Legendary", c: "#ffc849" },
    { id: 5, key: "transcendent", ko: "초월", en: "Transcendent", c: "#ff7bd5" },
  ].map(Object.freeze));
  // 0.00000000000000001% = exactly one winning integer out of 10^19.
  // Rejection sampling removes the bias from reducing a 64-bit draw modulo 10^19.
  const chanceDenominator = 10000000000000000000n, range = 1n << 64n, limit = range - range % chanceDenominator;
  function rollTranscendent(randomBytes) {
    for (;;) {
      const bytes = randomBytes(8); if (bytes.length !== 8) throw Error("Expected eight random bytes");
      let value = 0n; for (const byte of bytes) value = (value << 8n) | BigInt(byte);
      if (value < limit) return value === 0n;
    }
  }
  const api = Object.freeze({ list, max: list.length, transcendentPercent: "0.00000000000000001", chanceDenominator: String(chanceDenominator), rollTranscendent, label: (id, lang = "ko") => list.find((row) => row.id === id)?.[lang === "en" ? "en" : "ko"] || "" });
  if (typeof module === "object" && module.exports) module.exports = api; else root.SKIN_TIERS = api;
})(typeof window === "object" ? window : globalThis);
