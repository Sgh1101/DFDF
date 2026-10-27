// Game backend: accounts (id + password, no e-mail), guests, levels, the
// public room list, bans, server logs, the owner's settings, and the owner's
// admin page. One function, `?a=<action>`. Data lives in Redis (Upstash REST,
// connected from the Vercel dashboard). The owner password is never in the
// repository: it is the ADMIN_MASTER_PASS environment variable.
const crypto = require("crypto");
const SKIN_TIERS = require("../js/skin-tiers");
// every agent of the game (id, name, role): the owner page lists it, the settings keep only these ids
const ROSTER = require("../js/agent-roster.json");
const { AsyncLocalStorage } = require("async_hooks");
const requestState = new AsyncLocalStorage();
const SNAPSHOT = Symbol("storedUser");

async function fetchTimed(url, options = {}) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 8000);
  try { return await fetch(url, { ...options, signal: controller.signal }); }
  finally { clearTimeout(timer); }
}

const RURL = process.env.KV_REST_API_URL || process.env.UPSTASH_REDIS_REST_URL || "";
const RTOK = process.env.KV_REST_API_TOKEN || process.env.UPSTASH_REDIS_REST_TOKEN || "";
const MASTER = process.env.ADMIN_MASTER_PASS || "";
// The owner's own game account: this id signs in only with the master
// password and gets every power in game. Kept out of the repository too.
const OWNER_ID = String(process.env.OWNER_ID || "").trim().toLowerCase();
const isOwnerId = (id) => !!OWNER_ID && String(id || "").toLowerCase() === OWNER_ID;
const masterOk = (pw) => !!MASTER && crypto.timingSafeEqual(crypto.createHash("sha256").update(String(pw || "")).digest(), crypto.createHash("sha256").update(MASTER).digest());
const SECRET = process.env.SESSION_SECRET || crypto.createHash("sha256").update("13|" + MASTER + "|" + RTOK).digest("hex");

// ── redis over REST ──
// commands are counted (in memory, written out every ~100) so the owner can
// see roughly how much of the monthly free allowance is used
let used = 0;
const month = () => new Date().toISOString().slice(0, 7);
async function flushUse(force) {
  if (!used || (!force && used < 100)) return;
  const n = used;
  used = 0;
  try {
    await fetchTimed(RURL.replace(/\/$/, "") + "/pipeline", { method: "POST", headers: { Authorization: "Bearer " + RTOK, "Content-Type": "application/json" }, body: JSON.stringify([["INCRBY", "usage:" + month(), String(n + 1)], ["EXPIRE", "usage:" + month(), String(40 * 86400)]]) });
  } catch (e) {}
}
async function redis(cmd) {
  if (!RURL) throw Object.assign(new Error("저장소가 연결되지 않았습니다"), { code: 503 });
  used++;
  const r = await fetchTimed(RURL, { method: "POST", headers: { Authorization: "Bearer " + RTOK, "Content-Type": "application/json" }, body: JSON.stringify(cmd) });
  if (!r.ok) throw Object.assign(new Error("저장소에 연결할 수 없습니다"), { code: 503 });
  const j = await r.json();
  if (j.error) throw new Error(j.error);
  return j.result;
}
async function pipe(cmds) {
  if (!cmds.length) return [];
  if (!RURL) throw Object.assign(new Error("저장소가 연결되지 않았습니다"), { code: 503 });
  used += cmds.length;
  const r = await fetchTimed(RURL.replace(/\/$/, "") + "/pipeline", { method: "POST", headers: { Authorization: "Bearer " + RTOK, "Content-Type": "application/json" }, body: JSON.stringify(cmds) });
  if (!r.ok) throw Object.assign(new Error("저장소에 연결할 수 없습니다"), { code: 503 });
  const j = await r.json();
  if (!Array.isArray(j) || j.length !== cmds.length || j.some((x) => !x || x.error)) throw new Error("저장소 명령에 실패했습니다");
  return j.map((x) => x.result);
}
const getJ = async (k) => {
  const v = await redis(["GET", k]);
  if (!v) return null;
  const out = JSON.parse(v);
  if (out && typeof out === "object" && /^(user|guest):/.test(k)) Object.defineProperty(out, SNAPSHOT, { value: v, writable: true });
  return out;
};
const setJ = (k, v, ex) => redis(ex ? ["SET", k, JSON.stringify(v), "EX", String(ex)] : ["SET", k, JSON.stringify(v)]);

// ── settings the owner controls (merged over these defaults) ──
const DEFAULT_CONFIG = {
  game: {
    maintenance: !1,
    maintenanceMsg: "점검 중입니다. 잠시 후 다시 접속해 주세요.",
    announcement: "",
    // the promo film card in the notice that comes up after signing in on the homepage, and its ▶ button
    promoNotice: !0,
    guestAllowed: !0,
    mobileServer: !0, // a server only phones and the app can play on
    registerOpen: !0,
    maxRoomPlayers: 10,
    roomListOpen: !0,
    // maps out of the pool (7 · 5 · 3) the owner brings back: keys, comma separated, or "all"
    extraMaps: "",
    // agents the owner switched off (ids, comma separated): they leave the picker, the bots and the random pick
    disabledAgents: "",
  },
  cheat: {
    enabled: !0,
    codeLength: 4,
    startAtMiddle: !0,
    moveAfterUse: !0,
    resetEachRound: !0,
    wrongWaitSec: 2,
    refillSec: 5,
    ultInfinite: !1,
    allow: { radar: !0, wall: !0, cheat: !0, god: !0, oneShot: !0, infAmmo: !0, noRecoil: !0, speed: !0, fastFire: !0 },
    maxSpeed: 3,
    maxFastFire: 10,
  },
  // room rules every host applies when `force` is on (0 = the game's own default)
  room: { force: !1, roundT: 0, buyT: 0, matchT: 0, run: 0, jumpV: 0, gravity: 0, aiSpeed: 0, infAll: !1, freezeAI: !1 },
  // (maxPerDay: the day's ceiling on match XP, counted from midnight in Korea; 0 = none)
  xp: { perKill: 10, perWin: 50, perMatch: 20, perLevel: 100, maxPerReport: 600, maxPerDay: 6000 },
  // gold after each match, spent on skin pulls
  // (maxPerDay: a match's result is what the game reports, so a day's match gold
  // has a ceiling and a modified game cannot report its way to every skin; 0 = none)
  // (coinsPerDay: the Champion coins one account earns from matches in a day, same day as
  // maxPerDay; a match past it still counts but gives no coin; 0 = none)
  gold: { signup: 300, perWin: 100, perLoss: 30, perKill: 5, maxPerReport: 500, maxPerDay: 10000, coinsPerDay: 30 },
  // a pull: the odds of each tier (any numbers; they are weights), what one or
  // ten cost, and the highest tier a bot is seen wearing
  gacha: { cost1: 300, cost10: 2700, odds: { common: 60, rare: 25, epic: 11, legendary: 4 }, botMaxTier: 4 },
  // the daily shop: every day (midnight in Korea) twenty skins, the same for everyone, sold
  // for gold at a fixed price by tier, dearer than a pull but the skin you choose. mix: how
  // many of each tier; knife: the knives that are other knives cost this many times more;
  // reroll: raise it to change today's shop at once
  // weekly: next to it, from Monday (Korea) a few epic and legendary skins at off% off for
  // the whole week; its own reroll number
  shop: { on: !0, mix: { common: 7, rare: 6, epic: 4, legendary: 3 }, price: { common: 1200, rare: 3000, epic: 7000, legendary: 15000 }, knife: 1.5, reroll: 0, weekly: { on: !0, mix: { epic: 2, legendary: 3 }, off: 30, reroll: 0 } },
  // the rank (tier): rating points (RR) after each match. A win adds win + perKill
  // a kill (up to maxKill); a loss takes loss, less half the kill bonus (never
  // under half of loss). 100 RR a division, three divisions a tier; a day's
  // gain has a ceiling, as the result is what the game reports (0 = none). RR moves
  // only in a ranked room (admin and cheats off) and with at least minHumans people
  rank: { win: 20, loss: 12, perKill: 1, maxKill: 8, maxPerDay: 300, minHumans: 3 },
  // profile cosmetics (titles, name cards, kill effects) bought with gold: the price of one by
  // its tier (1 common … 4 legendary); on switches the whole thing
  cos: { on: !0, price: { 1: 600, 2: 1800, 3: 4500, 4: 10000 } },
  // paid cheats, by bank transfer: a player picks cheats and a length, gets an order number and the
  // account to pay (set here, never in the repository), and the owner opens them in the admin page
  // once the money has arrived. price is for 7 days; dur multiplies it by length (d0 = permanent).
  order: {
    on: !1,
    bank: "",
    holder: "",
    note: "입금이 확인되면 운영자가 직접 열어 드립니다. 보통 하루 안에 열립니다.",
    price: { radar: 3000, wall: 5000, cheat: 4000, oneShot: 8000, infAmmo: 2000, noRecoil: 2000, speed: 3000, fastFire: 3000, buff: 4000, gold1k: 2000, gold5k: 9000, gold20k: 30000 },
    dur: { d1: 0.3, d7: 1, d30: 3, d0: 10 },
  },
  // seasons: every `weeks` weeks from startDay (a date in Korea, YYYYMMDD) a season ends.
  // Each account keeps keep% of its RR; whoever played at least minPlay counted ranked
  // matches in it gets the gold of the tier it finished on, and from skinTier up (0 iron …
  // 8 radiant, 9 nobody) the season's own skin, 월계관, on every gun. skip: seasons the
  // owner ended early (the panel's "end it now" moves startDay to today and raises skip)
  season: { on: !0, weeks: 4, startDay: 20261001, skip: 0, keep: 50, minPlay: 3, skinTier: 3, gold: { iron: 100, bronze: 200, silver: 400, gold: 700, platinum: 1000, diamond: 1500, ascendant: 2200, immortal: 3000, radiant: 5000 } },
  // daily and weekly missions: how many (matches, kills, wins) and the gold each pays
  // when claimed. Counted here from the match reports; a day starts at midnight in
  // Korea, a week on Monday. 0 turns a mission off.
  // aim assist: on phones free for everyone (a switch in the game's settings), on a
  // computer only for accounts the owner opened it for (or in admin mode), never in a
  // ranked room on a computer. strength in %, range in metres, cone in degrees;
  // ranked: phones keep it in ranked rooms
  aim: { mobile: !0, pc: !0, strength: 35, range: 45, cone: 8, ranked: !0 },
  mission: { dPlay: 3, dPlayGold: 100, dKill: 15, dKillGold: 150, dWin: 1, dWinGold: 150, wPlay: 15, wPlayGold: 500, wKill: 100, wKillGold: 700, wWin: 7, wWinGold: 800 },
  channels: [
    { id: "s1", name: "서버 1", en: "Server 1" },
    { id: "s2", name: "서버 2", en: "Server 2" },
    { id: "free", name: "자유 서버", en: "Casual" },
    { id: "mobile", name: "모바일 전용", en: "Mobile only", mobile: !0 },
  ],
};
const isObj = (v) => v && "object" == typeof v && !Array.isArray(v);
function merge(base, over) {
  if (!isObj(base) || !isObj(over)) return over === undefined ? base : over;
  const out = Object.assign({}, base);
  for (const k in over) out[k] = Object.hasOwn(base, k) ? (isObj(base[k]) ? merge(base[k], over[k]) : typeof over[k] === typeof base[k] || Array.isArray(base[k]) ? over[k] : base[k]) : out[k];
  return out;
}
let cfgCache = null;
const loadConfig = async () => {
  if (cfgCache && cfgCache.until > Date.now()) return cfgCache.c;
  const c = merge(DEFAULT_CONFIG, (await getJ("config")) || {});
  c.xp.perLevel = Math.max(1, Number.isFinite(+c.xp.perLevel) ? +c.xp.perLevel : 100);
  // the mobile-only server: there when switched on (also in older saved settings), gone when off
  c.channels = (c.channels || []).filter((x) => c.game.mobileServer || !x.mobile);
  c.game.mobileServer && !c.channels.some((x) => x.mobile) && c.channels.push({ id: "mobile", name: "모바일 전용", en: "Mobile only", mobile: !0 });
  cfgCache = { c, until: Date.now() + 20000 };
  return c;
};

// ── helpers ──
const now = () => Date.now();
const ipOf = (req) => String(req.headers["x-forwarded-for"] || req.socket?.remoteAddress || "").split(",")[0].trim();
const b64 = (s) => Buffer.from(s).toString("base64url");
const sign = (o) => {
  const p = b64(JSON.stringify(o));
  return p + "." + crypto.createHmac("sha256", SECRET).update(p).digest("base64url");
};
function verify(t) {
  if (!t || "string" != typeof t || !t.includes(".")) return null;
  const parts = t.split(".");
  if (parts.length !== 2) return null;
  const [p, s] = parts;
  const want = crypto.createHmac("sha256", SECRET).update(p).digest("base64url");
  // multibyte characters pass the string-length check but not the byte-length one timingSafeEqual needs
  const got = Buffer.from(s), exp = Buffer.from(want);
  if (got.length !== exp.length || !crypto.timingSafeEqual(got, exp)) return null;
  try {
    const o = JSON.parse(Buffer.from(p, "base64url").toString());
    return o.exp > now() ? o : null;
  } catch (e) {
    return null;
  }
}
const hashPw = (pw, salt) => {
  salt = salt || crypto.randomBytes(12).toString("hex");
  return salt + ":" + crypto.scryptSync(String(pw), salt, 32).toString("hex");
};
const checkPw = (pw, stored) => {
  const [salt, h] = String(stored || "").split(":");
  if (!salt || !h) return !1;
  const a = Buffer.from(hashPw(pw, salt).split(":")[1], "hex"),
    b = Buffer.from(h, "hex");
  return a.length === b.length && crypto.timingSafeEqual(a, b);
};
const XP_MAX = 1e12; // the most xp an account counts for (levelOf)
const levelOf = (xp, per) => {
  xp = Math.max(0, Math.min(XP_MAX, Number.isFinite(+xp) ? +xp : 0));
  per = Math.max(1, Number.isFinite(+per) ? +per : 100);
  const lv = Math.floor((Math.sqrt(1 + 8 * xp / per) - 1) / 2) + 1;
  return { level: lv, into: xp - per * (lv - 1) * lv / 2, need: per * lv };
};
const cleanId = (s) => String(s || "").trim();
const ID_OK = /^[A-Za-z0-9_가-힣]{2,16}$/;
// names a new account may not take: they read as a guest or a nameless player in a room
const RESERVED_ID = /^(게스트|guest)|^(플레이어|player)\d+$/i;
// names that are also keys of every plain object: as a key in a map of accounts they would be lost or break it
const PROTO_ID = /^(__proto__|constructor|prototype)$/i;
// ── the per-account activity log ──
// `ulog:<id>` holds what one account did (sign-ins with IP and device, pulls, buys, matches, what the
// owner changed on it), newest first: the latest ULOG_MAX lines, gone ULOG_DAYS days after the last one.
// Only the owner page reads it (ADMIN.user_profile). `data` is small and chosen by the caller: never put a
// token, password or hash in it (the keys below are dropped as a second guard). `dg` is the gold change.
const ULOG_MAX = 500,
  ULOG_DAYS = 180,
  ULOG_SECRET = /pass|^pw$|token|secret|hash|session/i;
const ulogKey = (id) => "ulog:" + String(id || "").toLowerCase().slice(0, 40);
function ulogCmds(id, kind, msg, data) {
  const d = {};
  if (isObj(data)) for (const k in data) data[k] != null && !ULOG_SECRET.test(k) && (d[k] = data[k]);
  let json = Object.keys(d).length ? JSON.stringify(d) : "";
  json.length > 600 && (json = JSON.stringify({ cut: 1 }));
  const line = { t: now(), k: String(kind).slice(0, 12), m: String(msg || "").replace(/[\u0000-\u001f]/g, " ").slice(0, 140) };
  json && (line.d = JSON.parse(json));
  const key = ulogKey(id);
  return [["LPUSH", key, JSON.stringify(line)], ["LTRIM", key, "0", String(ULOG_MAX - 1)], ["EXPIRE", key, String(ULOG_DAYS * 86400)]];
}
async function ulog(id, kind, msg, data) {
  if (!id) return;
  try { await pipe(ulogCmds(id, kind, msg, data)); } catch (e) {}
}
// entries of the server log that also belong in an account's own log (the others call ulog with more detail)
const ULOG_FROM_LOG = new Set(["order", "room", "level", "rank", "feedback"]);
async function log(type, msg, extra) {
  try {
    const cmds = [
      ["LPUSH", "logs", JSON.stringify(Object.assign({ t: now(), type, msg }, extra || {}))],
      ["LTRIM", "logs", "0", "4999"],
    ];
    extra && extra.user && ULOG_FROM_LOG.has(type) && cmds.push(...ulogCmds(extra.user, type, msg, { id: extra.id, room: extra.room }));
    await pipe(cmds);
  } catch (e) {}
}
// a little brake on guessing passwords
async function limited(key, max, sec) {
  const memo = requestState.getStore();
  const mk = key + "|" + max + "|" + sec;
  if (memo && memo.has(mk)) return memo.get(mk);
  // EXPIRE NX only starts a window on a key that has none, so a live window is never extended and a key
  // whose first EXPIRE was lost gets its window on the next call instead of counting up forever
  const [n] = await pipe([["INCR", "rl:" + key], ["EXPIRE", "rl:" + key, String(sec), "NX"]]);
  const out = n > max;
  memo && memo.set(mk, out);
  return out;
}
async function banOf(user, device, ip) {
  const [d, i] = await pipe([
    ["GET", "ban:dev:" + (device || "-")],
    ["GET", "ban:ip:" + (ip || "-")],
  ]);
  const t = now();
  if (user && user.ban && (!user.ban.until || user.ban.until > t)) return user.ban;
  for (const v of [d, i]) {
    if (!v) continue;
    const b = JSON.parse(v);
    if (!b.until || b.until > t) return b;
  }
  return null;
}
// cheats the owner opened for one account, item by item: switches, the most
// it may speed itself up or fire faster, and the buff (every ability but the
// ultimate back every so many seconds). `until` 0 means no end date.
const PERM_SW = ["radar", "wall", "cheat", "god", "oneShot", "infAmmo", "noRecoil"];
function cleanPerm(p, days) {
  p = p && "object" == typeof p ? p : {};
  const num = (v, lo, hi, d) => Math.max(lo, Math.min(hi, isFinite(+v) ? +v : d));
  const out = { on: !!p.on };
  for (const k of PERM_SW) out[k] = !!p[k];
  out.speed = Math.round(num(p.speed, 1, 3, 1) * 100) / 100;
  out.fastFire = Math.round(num(p.fastFire, 1, 10, 1) * 10) / 10;
  out.buff = Math.round(num(p.buff, 0, 120, 0));
  out.until = days > 0 ? now() + days * 864e5 : 0;
  return out;
}
// what an account in admin mode may change on a room: every knob of the
// panel's room-wide tab, unless the owner closed some
const ADMIN_KNOBS = ["run", "roundT", "buyT", "matchT", "jumpV", "gravity", "aiSpeed", "infAll", "freezeAI"];
const cleanAllow = (a) => {
  if (!isObj(a)) return null;
  const o = {};
  for (const k of ADMIN_KNOBS) o[k] = !1 !== a[k];
  return o;
};
// aim assist for one account: pc is a grant from the owner (until 0 = no end), mobile is on unless the owner closed it
const aimOf = (u) => {
  const a = u && isObj(u.aim) ? u.aim : {};
  return { pc: !!a.pc && !(a.until && a.until < now()), mobile: !1 !== a.mobile, until: a.pc && a.until ? a.until : 0 };
};
// the account's cheats if they are switched on and not past their date. Admin mode lends the account a full set
// (permAdmin, see adminCheats) only while it lasts: once it has run out, the account's own cheats are back.
const activePerm = (u) => {
  u && u.permAdmin && !(u.adminUntil && u.adminUntil > now()) && adminCheats(u);
  return u && u.perm && u.perm.on && !(u.perm.until && u.perm.until < now()) ? u.perm : null;
};
// where the account's own cheats live: under the full set admin mode lends (permBefore), or in perm itself
const ownPerm = (u) => (u.permAdmin ? u.permBefore || null : u.perm || null);
const setOwnPerm = (u, p) => (u.permAdmin ? (u.permBefore = p) : (u.perm = p));
// the tiers, low to high: 3 divisions of 100 RR each, then Radiant from 2400 RR
const RANKS = ["iron", "bronze", "silver", "gold", "platinum", "diamond", "ascendant", "immortal", "radiant"];
const rankOf = (rr) => {
  rr = Math.max(0, Math.round(+rr || 0));
  const d = Math.floor(rr / 100);
  return d >= 24 ? { rr, t: 8, tier: RANKS[8], div: 0, into: rr - 2400 } : { rr, t: Math.floor(d / 3), tier: RANKS[Math.floor(d / 3)], div: (d % 3) + 1, into: rr % 100 };
};
// ── hidden MMR and placement ──
// Every account carries a hidden `mmr` (an Elo rating) next to the visible RR. The
// first PLACE_N counted ranked matches are placement: MMR swings hard (K_PLACE), the
// tier stays hidden, and after the last one RR is set from MMR. After that RR moves by the
// base win/loss value scaled by how strong the other team was (see rrDelta).
const MMR_BASE = 1000, // MMR of 0 RR; one RR is one MMR point when an account is first read
  ELO_SCALE = 400,
  PLACE_N = 5,
  K_PLACE = 120,
  K_RANKED = 32,
  RANGE_BASE = 150, // a ranked room takes players within this many MMR of its average...
  RANGE_STEP = 50, // ...plus this much for every minute the room has been open...
  RANGE_MAX = 600, // ...up to this
  BAND = 50; // the room's average MMR is shown rounded to this
const mmrFromRR = (rr) => MMR_BASE + Math.max(0, Math.round(+rr || 0));
const rrFromMMR = (m) => Math.max(0, Math.round((+m || 0) - MMR_BASE));
// chance (0..1) that a team averaging `mine` beats one averaging `theirs`
const eloExpected = (mine, theirs) => 1 / (1 + Math.pow(10, ((+theirs || 0) - (+mine || 0)) / ELO_SCALE));
const mmrAfter = (mmr, expected, score, placing) => Math.max(0, Math.min(9999, Math.round((+mmr || 0) + (placing ? K_PLACE : K_RANKED) * (score - expected))));
// RR change after placement: the base win/loss value times a factor in [0.5, 1.5] from the
// opponent's strength (beat a stronger team: more; lose to a weaker one: more), plus the kill
// bonus as before (a win adds it; a loss takes less, never under half the loss)
function rrDelta(R, win, expected, kills) {
  const kb = Math.max(0, Math.min(+R.maxKill || 0, (kills | 0) * (+R.perKill || 0))),
    clamp = (x) => Math.max(0.5, Math.min(1.5, x));
  if (win) return Math.round((+R.win || 0) * clamp(0.5 + (1 - expected))) + kb;
  const loss = (+R.loss || 0) * clamp(0.5 + expected);
  return -Math.max(Math.ceil(loss / 2), Math.round(loss - kb / 2));
}
const joinRange = (ageMs) => Math.min(RANGE_MAX, RANGE_BASE + RANGE_STEP * Math.floor(Math.max(0, +ageMs || 0) / 60000));
const bandOf = (mmr) => Math.round(mmr / BAND) * BAND;
// May this account (its mmr) join that ranked room (its average mmr, when it opened)? The
// owner and any room without a measured average are open. Only the answer leaves the server.
function canJoinRanked(account, room, t = now()) {
  const range = joinRange(t - ((room && +room.created) || t));
  if (!room || !room.ranked || account.owner || !Number.isFinite(room.mmr)) return { ok: !0, range };
  return { ok: Math.abs(account.mmr - room.mmr) <= range, range };
}
// an account from before MMR counts as placed when it already has RR or ranked history
const legacyPlaced = (u) => (+u.rr || 0) > 0 || (isObj(u.ssn) && (u.ssn.played | 0) > 0) || (Array.isArray(u.hist) && u.hist.some((m) => m && m.rk));
const placedOf = (u) => (Number.isFinite(u.placed) ? Math.max(0, Math.min(PLACE_N, u.placed | 0)) : legacyPlaced(u) ? PLACE_N : 0);
const mmrOf = (u) => (Number.isFinite(u.mmr) ? u.mmr : mmrFromRR(u.rr));
// first read of an older account: MMR from its RR, placement already done if it has played ranked
function rankInit(u) {
  if (u.guest || (Number.isFinite(u.mmr) && Number.isFinite(u.placed))) return !1;
  u.placed = placedOf(u);
  u.mmr = mmrOf(u);
  return !0;
}
// what the account shows: the tier while placing is hidden
const rankView = (u) => (!u.guest && placedOf(u) < PLACE_N ? Object.assign(rankOf(0), { hidden: !0 }) : rankOf(u.rr));
const publicUser = (u, per) => {
  const lv = levelOf(u.xp || 0, per);
  return { id: u.id, guest: !!u.guest, xp: u.xp || 0, level: lv.level, into: lv.into, need: lv.need, kills: u.kills || 0, wins: u.wins || 0, matches: u.matches || 0, admin: !!(u.owner || (u.adminUntil && u.adminUntil > now())), owner: !!u.owner, adminUntil: u.adminUntil || 0, created: u.created, perm: activePerm(u), adminAllow: isObj(u.adminAllow) ? u.adminAllow : null, gold: "number" == typeof u.gold ? u.gold : 0, championCoins: Number.isSafeInteger(u.championCoins) ? u.championCoins : 0, owned: ownedCount(u), items: ITEMS, pulls: u.pulls || 0, rank: rankView(u), placement: u.guest ? null : { done: placedOf(u), of: PLACE_N }, misReady: (isObj(u.mis) && u.mis.ready) || 0, aim: aimOf(u), cos: cosOf(u), season: isObj(u.ssn) ? { n: u.ssn.n, end: u.ssn.end, played: u.ssn.played | 0, need: u.ssn.need | 0, last: (Array.isArray(u.ssnLog) && u.ssnLog[0]) || null } : null };
};
const userKey = (id) => "user:" + id.toLowerCase();
const guestKey = (dev) => "guest:" + String(dev || "").slice(0, 64);

// the request's JSON as an object: a body that is not one ("null", a number, text) reads as empty, so the
// action answers with its own 400/401 instead of a TypeError (500) on the first field it reads
async function body(req) {
  if (req.body && "object" == typeof req.body) return req.body;
  if ("string" == typeof req.body) {
    try {
      const v = JSON.parse(req.body);
      return v && "object" == typeof v ? v : {};
    } catch (e) {
      return {};
    }
  }
  const chunks = [];
  for await (const c of req) chunks.push(c);
  try {
    const v = JSON.parse(Buffer.concat(chunks).toString() || "{}");
    return v && "object" == typeof v ? v : {};
  } catch (e) {
    return {};
  }
}
const fail = (code, msg) => Object.assign(new Error(msg), { code });

// the signed-in player (account or guest) behind a token
async function who(token) {
  const s = verify(token);
  if (!s || "p" !== s.k) return null;
  const u = await getJ(s.g ? guestKey(s.id) : userKey(s.id));
  if (!u || !s.v || s.v !== u.sessionVersion || (u.owner && s.pv !== 2)) return null;
  if (!(u.owner && isOwnerId(u.id))) {
    const ban = await banOf(u, u.dev, requestState.getStore()?.get("requestIp") || u.lastIp);
    if (ban) throw Object.assign(fail(403, "이용이 제한되었습니다"), { ban });
  }
  return Object.assign(u, { _s: s });
}
// Compare and commit the entire record atomically. A stale request is retried
// from fresh data; it can never replace another request's wallet or settings.
const USER_COMMIT = `
local current = redis.call('GET', KEYS[1]) or ''
if current ~= ARGV[1] then return 0 end
if KEYS[2] ~= '' and redis.call('GET', KEYS[2]) ~= ARGV[3] then return -1 end
redis.call('SET', KEYS[1], ARGV[2])
if KEYS[2] ~= '' then
  redis.call('DEL', KEYS[2])
  redis.call('SET', KEYS[3], ARGV[4], 'EX', 2592000)
end
return 1`;
async function saveUser(u, report) {
  const key = u.guest ? guestKey(u.dev) : userKey(u.id);
  const value = JSON.stringify(Object.assign({}, u, { _s: undefined }));
  const result = +await redis(["EVAL", USER_COMMIT, "3", key, report ? report.ticketKey : "", report ? report.key : "", u[SNAPSHOT] || "", value, report ? String(u.id) : "", report ? JSON.stringify(report.value) : ""]);
  if (result === 0) throw Object.assign(fail(409, "다른 요청과 겹쳤습니다. 다시 시도해 주세요"), { retryUser: true });
  if (result !== 1) throw fail(409, "이미 처리된 경기입니다");
  if (Object.hasOwn(u, SNAPSHOT)) u[SNAPSHOT] = value;
  else Object.defineProperty(u, SNAPSHOT, { value, writable: true });
}
const rlKey = (u) => (u.guest ? "g:" + String(u.dev || "").slice(0, 32) : u.id);

// ── gun skins: what there is to win ──
// One item is one skin on one gun. The lists must match the game's (its
// WEAPONS table and GUN_SKINS.list); a test compares them.
const SKIN_TIER = { snow: 1, jungle: 1, desert: 1, urban: 1, navy: 1, carbon: 2, tiger: 2, sakura: 2, celadon: 2, marble: 2, hex: 2, wave: 2, dancheong: 3, ink: 3, gold: 3, neon: 3, circuit: 3, dragon: 3, aurora: 3, lava: 4, galaxy: 4, phoenix: 4, storm: 4, flip: 2, tanto: 3, kukri: 3, karambit: 4, butterfly: 4, bayonet: 1, gut: 1, bowie: 2, kunai: 3, stiletto: 4, koi: 3, kintsugi: 3, prism: 3, abyss: 4, synth: 4, opal: 4, laurel: 4, champion: 4 };
const VALORANT = require('../js/valorant-data');
for (const skin of VALORANT.knives) SKIN_TIER[skin.id] = skin.rar;
SKIN_TIER.champions_atk = SKIN_TIER.champions_def = 5;
// skins no pull or shop gives: only the end of a season (or the owner)
const EXCLUSIVE = { laurel: "season", champions_atk: "coins", champions_def: "coins" };
// skins only one gun can wear (the knives that are other knives)
const SKIN_ONLY = { flip: "knife", tanto: "knife", kukri: "knife", karambit: "knife", butterfly: "knife", bayonet: "knife", gut: "knife", bowie: "knife", kunai: "knife", stiletto: "knife" };
SKIN_ONLY.champions_atk = SKIN_ONLY.champions_def = VALORANT.championsWeapon;
for (const skin of VALORANT.knives) SKIN_ONLY[skin.id] = 'knife';
const fits = (s, g) => !SKIN_ONLY[s] || SKIN_ONLY[s] === g;
const SKIN_IDS = Object.keys(SKIN_TIER);
const GUNS = ["knife", "pistol", "silenced", "revolver", "machpist", "handcan", "smg", "vector", "pdw", "shotgun", "autoshot", "slugger", "rifle", "carbine", "battle", "burst", "lmg", "hmg", "marksman", "sniper", "stinger", "pocketshot", "ripper", "whisper", "burstsmg", "doublebarrel", "scout", "bullpup", "minigun", "antimat", "rpg"].filter(key => !VALORANT.aliases[key]);
const ITEMS = GUNS.reduce((n, g) => n + SKIN_IDS.filter((s) => fits(s, g)).length, 0);
const TIER_KEYS = SKIN_TIERS.list.map((tier) => tier.key);
// the summary of a match the game sends with its report: only these fields,
// each clamped. The account keeps the last thirty.
const HIST_MAX = 30;
function cleanMatch(m, win, kills) {
  if (!isObj(m)) return null;
  const str = (v, n) => String(v || "").replace(/[<>&"]/g, "").slice(0, n);
  const num = (v, hi) => Math.max(0, Math.min(hi, Math.round(+v) || 0));
  const s = Array.isArray(m.s) ? [num(m.s[0], 999), num(m.s[1], 999)] : [0, 0];
  return { mode: /^[a-z]{1,8}$/.test(m.mode) ? m.mode : "std", map: str(m.map, 24), agent: str(m.agent, 24), k: kills, d: num(m.d, 200), a: num(m.a, 200), dmg: num(m.dmg, 99999), cs: num(m.cs, 9999), rank: num(m.rank, 40), n: num(m.n, 40), s, win: !!win, mvp: !!m.mvp };
}
const histOf = (u) => (Array.isArray(u.hist) ? u.hist.slice(0, HIST_MAX) : []);
// a wallet for an account from before gold: the sign-up gold once, an empty collection
// skins taken out of the game (plain single colours): whoever had them gets gold back,
// one pull's worth each (three for a legendary), the first time the account is read
const RETIRED = { obsidian: 1, ice: 2, holo: 4 };
function ensureWallet(u, c) {
  let changed = !1;
  if (!Number.isSafeInteger(u.championCoins) || u.championCoins < 0) { u.championCoins = 0; changed = true; }
  if ("number" != typeof u.gold || !isFinite(u.gold)) ((u.gold = c.gold.signup), (changed = !0));
  if (!isObj(u.own)) ((u.own = {}), (changed = !0));
  // Restore archived copies once when a consolidated weapon returns. Leave
  // current equipment, migrated copies and previous compensation intact.
  for (const key of VALORANT.restored) {
    if (!Array.isArray(u.weaponArchive?.[key]) || u.weaponRestored?.[key]) continue;
    const archived = u.weaponArchive[key].filter(s => SKIN_TIER[s] && fits(s, key) && !RETIRED[s]);
    u.own[key] = [...new Set([...(Array.isArray(u.own[key]) ? u.own[key] : []), ...archived])];
    if (!isObj(u.weaponRestored)) u.weaponRestored = {};
    u.weaponRestored[key] = true; changed = true;
  }
  // Move all previously sold Champions copies to the renamed Phantom. Preserve
  // ordinary skins, the target's current choice and both currency balances.
  const phantom = (s) => s === "champions_atk" || s === "champions_def";
  const championGun = VALORANT.championsWeapon;
  for (const old of ["carbine", "rifle"]) {
    const moved = Array.isArray(u.own[old]) ? u.own[old].filter(phantom) : [];
    if (moved.length) {
      u.own[championGun] = [...new Set([...(Array.isArray(u.own[championGun]) ? u.own[championGun] : []), ...moved])];
      u.own[old] = u.own[old].filter(s => !phantom(s)); changed = true;
    }
    if (isObj(u.skins?.m) && phantom(u.skins.m[old])) {
      const previous = u.skins.m[old];
      if ((!u.skins.m[championGun] || u.skins.m[championGun] === "default") && hasItem(u, championGun, previous)) u.skins.m[championGun] = previous;
      delete u.skins.m[old];
      u.skins.t = Math.max(+u.skins.t || 0, now()) + 1; changed = true;
    }
  }
  let back = 0;
  // Preserve retired copies in an archive and move skins without charging.
  for (const [old, target] of Object.entries(VALORANT.aliases)) {
    if (Array.isArray(u.own[old])) {
      const list = u.own[old];
      u.weaponArchive = isObj(u.weaponArchive) ? u.weaponArchive : {};
      u.weaponArchive[old] = [...new Set([...(Array.isArray(u.weaponArchive[old]) ? u.weaponArchive[old] : []), ...list])];
      u.own[target] = Array.isArray(u.own[target]) ? u.own[target] : [];
      for (const skin of new Set(list)) {
        if (u.own[target].includes(skin)) back += Math.max(0, Math.round(+c.gacha.cost1 || 0)) * (SKIN_TIER[skin] === 4 ? 3 : 1);
        else u.own[target].push(skin);
      }
      delete u.own[old]; changed = true;
    }
    if (isObj(u.skins?.m) && u.skins.m[old]) {
      const skin = u.skins.m[old];
      if ((!u.skins.m[target] || u.skins.m[target] === 'default') && hasItem(u, target, skin)) u.skins.m[target] = skin;
      delete u.skins.m[old]; u.skins.t = Math.max(+u.skins.t || 0, now()) + 1; changed = true;
    }
  }
  if (Array.isArray(u.wish)) {
    const wish = [...new Set(u.wish.map(value => { if (typeof value !== 'string') return value; const [g,s] = value.split('|'); return VALORANT.canonical(g) + '|' + s; }))];
    if (JSON.stringify(wish) !== JSON.stringify(u.wish)) { u.wish = wish; changed = true; }
  }
  for (const g in u.own) {
    if (!Array.isArray(u.own[g])) continue;
    const keep = u.own[g].filter((s) => !RETIRED[s]);
    for (const s of u.own[g]) RETIRED[s] && (back += Math.max(0, Math.round(+c.gacha.cost1 || 0)) * (4 === RETIRED[s] ? 3 : 1));
    keep.length !== u.own[g].length && ((u.own[g] = keep), (changed = !0));
  }
  if (back) {
    u.gold = Math.min(9e6, u.gold + back);
    u.refunded = (u.refunded || 0) + back;
  }
  rankInit(u) && (changed = !0);
  seasonRoll(u, c) && (changed = !0);
  changed && trimPicks(u);
  return changed;
}
// ── seasons ──
// Which season it is: counted in whole seasons from the first day (midnight in Korea).
const KST_MS = 9 * 36e5;
const ymdStart = (v) => {
  const n = Math.round(+v) || 20261001;
  return Date.UTC(Math.floor(n / 1e4), (Math.floor(n / 100) % 100) - 1, n % 100) - KST_MS;
};
function seasonNow(c, t = now()) {
  const S = (c && c.season) || {},
    len = Math.max(1, Math.round(+S.weeks || 4)) * 7 * 864e5,
    st = ymdStart(S.startDay),
    k = Math.max(0, Math.floor((t - st) / len));
  return { n: 1 + k + Math.max(0, Math.round(+S.skip || 0)), start: st + k * len, end: st + (k + 1) * len, on: !!S.on };
}
// what an account's RR would be after the seasons it has not been seen in
const keepOf = (c) => Math.max(0, Math.min(100, +c.season.keep || 0)) / 100;
const seasonRR = (u, c, cur) => (c.season.on && isObj(u.ssn) && u.ssn.n < cur.n ? Math.round(Math.max(0, +u.rr || 0) * Math.pow(keepOf(c), cur.n - u.ssn.n)) : Math.max(0, Math.round(+u.rr || 0)));
// An account seen after its season ended: the reward for the tier it finished on (if it
// played enough), then the RR cut, once for every season that went by. Guests have no rank.
function seasonRoll(u, c) {
  if (!c.season || !c.season.on || u.guest) return !1;
  const cur = seasonNow(c),
    need = Math.max(1, Math.round(+c.season.minPlay || 0));
  if (!isObj(u.ssn)) return (u.ssn = { n: cur.n, end: cur.end, played: 0, need }), !0;
  if (u.ssn.n >= cur.n) return u.ssn.end !== cur.end || u.ssn.need !== need ? ((u.ssn.end = cur.end), (u.ssn.need = need), !0) : !1;
  const S = c.season,
    rk = rankOf(u.rr),
    played = u.ssn.played | 0;
  if (played > 0 || rk.rr > 0) {
    const rec = { n: u.ssn.n, t: rk.t, tier: rk.tier, div: rk.div, rr: rk.rr, played, gold: 0, skin: 0, at: now() };
    if (played > 0 && played >= Math.max(0, +S.minPlay || 0)) {
      rec.gold = Math.max(0, Math.round(+(isObj(S.gold) && S.gold[rk.tier]) || 0));
      u.gold = Math.min(9e6, (+u.gold || 0) + rec.gold);
      if ((S.skinTier | 0) <= 8 && rk.t >= (S.skinTier | 0)) {
        isObj(u.own) || (u.own = {});
        for (const g of GUNS) if (fits("laurel", g) && !hasItem(u, g, "laurel")) ((u.own[g] = Array.isArray(u.own[g]) ? u.own[g] : []).push("laurel"), rec.skin++);
      }
    }
    const cut = c.season.on && u.ssn.n < cur.n ? Math.pow(keepOf(c), cur.n - u.ssn.n) : 1;
    Number.isFinite(u.mmr) && (u.mmr = Math.round(MMR_BASE + (u.mmr - MMR_BASE) * cut));
    u.rr = seasonRR(u, c, cur);
    rec.after = u.rr;
    u.ssnLog = [rec].concat(Array.isArray(u.ssnLog) ? u.ssnLog : []).slice(0, 12);
  }
  u.ssn = { n: cur.n, end: cur.end, played: 0, need };
  return !0;
}
const ownedCount = (u) => {
  let n = 0;
  if (isObj(u.own)) for (const g in u.own) Array.isArray(u.own[g]) && (n += u.own[g].length);
  return n;
};
const hasItem = (u, g, s) => !!(isObj(u.own) && Array.isArray(u.own[g]) && u.own[g].includes(s) && fits(s, g));
// the tier a pull lands on, by the owner's weights
function rollTier(odds) {
  const w = TIER_KEYS.slice(0, 4).map((k) => Math.max(0, Math.floor(+(odds && odds[k]) || 0)));
  const tot = w.reduce((a, b) => a + b, 0);
  if (!tot) return 1;
  let x = crypto.randomInt(tot);
  for (let i = 0; i < w.length; i++) {
    if (x < w[i]) return i + 1;
    x -= w[i];
  }
  return 1;
}
const poolOf = (u, tier, allowCoins = false) => {
  const out = [];
  for (const s of SKIN_IDS) if (SKIN_TIER[s] === tier && (!EXCLUSIVE[s] || allowCoins && EXCLUSIVE[s] === "coins")) for (const g of GUNS) fits(s, g) && !hasItem(u, g, s) && out.push([g, s]);
  return out;
};
// one pull: never a duplicate. The tier is rolled; if every skin of that tier
// is already owned the next tier up is tried, and from the top back down.
function rollOne(u, odds) {
  const transcendent = poolOf(u, 5, true);
  if (transcendent.length && SKIN_TIERS.rollTranscendent(crypto.randomBytes)) {
    const [g, s] = transcendent[crypto.randomInt(transcendent.length)];
    (u.own[g] = u.own[g] || []).push(s);
    return { g, s, r: 5 };
  }
  const t = rollTier(odds),
    order = [];
  for (let x = t; x <= 4; x++) order.push(x);
  for (let x = t - 1; x >= 1; x--) order.push(x);
  for (const tier of order) {
    const pool = poolOf(u, tier);
    if (!pool.length) continue;
    const [g, s] = pool[crypto.randomInt(pool.length)];
    (u.own[g] = u.own[g] || []).push(s);
    return { g, s, r: tier };
  }
  return null;
}
// a picked skin stays picked only while it is owned
function trimPicks(u) {
  if (u.skins && isObj(u.skins.m)) for (const k in u.skins.m) hasItem(u, k, u.skins.m[k]) || delete u.skins.m[k];
}

// ── public actions ──
const A = {};
A.config = async () => {
  const c = await loadConfig();
  return { config: { order: { on: !!c.order.on }, game: c.game, cheat: c.cheat, room: c.room, xp: c.xp, gold: c.gold, gacha: Object.assign({ items: ITEMS, guns: GUNS.length, skins: SKIN_IDS.length }, c.gacha), aim: c.aim, shop: c.shop, channels: c.channels }, store: !!RURL };
};
A.auth = async (q, b, req) => {
  const c = await loadConfig(),
    ip = ipOf(req),
    id = cleanId(b.id),
    pw = String(b.pw || "");
  if (!ID_OK.test(id)) throw fail(400, "아이디는 2~16자 (한글·영문·숫자·_)");
  if (pw.length < 4 || pw.length > 64) throw fail(400, "비밀번호는 4~64자");
  if (await limited("auth:" + ip, 20, 600)) throw fail(429, "잠시 후 다시 시도하세요");
  let u = await getJ(userKey(id)),
    created = !1;
  if (isOwnerId(id)) {
    // the owner: only the master password, never a stored one; never banned
    if (await limited("adm:" + ip, 8, 900)) throw fail(429, "너무 많이 시도했습니다. 15분 뒤에 다시");
    if (!masterOk(pw)) {
      await log("admin", "운영자 계정 로그인 실패", { ip });
      await ulog(id, "loginfail", "운영자 계정 비밀번호 틀림", { ip, dev: String(b.device || "").slice(0, 64) });
      throw fail(401, "비밀번호가 틀렸습니다");
    }
    await redis(["DEL", "rl:adm:" + ip]); // only wrong guesses count against the owner's sign-in
    if (!u) (u = { id, created: now(), xp: 0, kills: 0, wins: 0, matches: 0 }), (created = !0), await redis(["ZADD", "users", String(now()), id.toLowerCase()]);
    ensureWallet(u, c);
    u.sessionVersion ||= crypto.randomBytes(16).toString("hex");
    u.owner = !0;
    u.pass = hashPw(crypto.randomBytes(24).toString("hex"));
    delete u.ban;
    u.lastSeen = now();
    u.lastIp = ip;
    u.dev = String(b.device || "").slice(0, 64);
    await saveUser(u);
    await log("admin", "운영자 계정 로그인: " + id, { ip, user: id });
    await ulog(id, created ? "join" : "login", created ? "운영자 계정 생성" : "운영자 계정 로그인", { ip, dev: u.dev, owner: 1 });
    return { token: sign({ k: "p", id, o: 1, v: u.sessionVersion, pv: 2, exp: now() + 30 * 864e5 }), atoken: sign({ k: "admin", pv: 2, exp: now() + 12 * 36e5 }), user: publicUser(u, c.xp.perLevel), created, hist: histOf(u) };
  }
  if (u) {
    if (!checkPw(pw, u.pass)) {
      await log("auth", "비밀번호 틀림: " + id, { ip });
      await ulog(u.id, "loginfail", "비밀번호 틀림", { ip, dev: String(b.device || "").slice(0, 64) });
      // the same sign-in box also signs up: a taken name must say so, not just "wrong password"
      throw fail(401, "이미 있는 아이디입니다. 내 계정이면 비밀번호를 확인하고, 새로 가입하려면 다른 아이디를 쓰세요");
    }
  } else {
    if (!c.game.registerOpen) throw fail(403, "지금은 새 가입을 받지 않습니다");
    if (RESERVED_ID.test(id)) throw fail(400, "게스트·플레이어로 시작하는 아이디는 쓸 수 없습니다");
    if (PROTO_ID.test(id)) throw fail(400, "쓸 수 없는 아이디입니다");
    u = { id, pass: hashPw(pw), created: now(), xp: 0, kills: 0, wins: 0, matches: 0 };
    created = !0;
    await redis(["ZADD", "users", String(now()), id.toLowerCase()]);
  }
  ensureWallet(u, c);
  u.sessionVersion ||= crypto.randomBytes(16).toString("hex");
  const ban = await banOf(u, b.device, ip);
  if (ban) {
    created || (await ulog(u.id, "blocked", "차단 중 로그인 시도", { ip, dev: String(b.device || "").slice(0, 64), why: ban.reason }));
    throw Object.assign(fail(403, "이용이 제한된 계정입니다"), { ban });
  }
  if (c.game.maintenance) throw fail(503, c.game.maintenanceMsg);
  u.lastSeen = now();
  u.lastIp = ip;
  u.dev = String(b.device || "").slice(0, 64);
  await saveUser(u);
  await log(created ? "join" : "login", (created ? "가입: " : "로그인: ") + id, { ip, user: id });
  await ulog(u.id, created ? "join" : "login", created ? "가입" : "로그인", { ip, dev: u.dev });
  return { token: sign({ k: "p", id, v: u.sessionVersion, exp: now() + 30 * 864e5 }), user: publicUser(u, c.xp.perLevel), created, hist: histOf(u) };
};
// Each guest name belongs to one device. Two devices used to land on the same "게스트NNNN" (9000 numbers); a
// name already held by another device, or by an account, moves to a free one.
const guestNameKey = (name) => "gname:" + String(name).toLowerCase();
async function guestName(want, dev) {
  const free = async (name) => {
    if (await getJ(userKey(name))) return !1;
    const held = await redis(["GET", guestNameKey(name)]);
    if (held === dev) return !0;
    return !held && "OK" === (await redis(["SET", guestNameKey(name), dev, "NX"]));
  };
  if (await free(want)) return want;
  for (let i = 0; i < 12; i++) {
    const name = "게스트" + (i < 8 ? crypto.randomInt(1000, 10000) : crypto.randomInt(10000, 100000));
    if (await free(name)) return name;
  }
  return "게스트" + crypto.randomBytes(3).toString("hex");
}
const GUEST_NEW_MAX = 60;
A.guest = async (q, b, req) => {
  const c = await loadConfig(),
    ip = ipOf(req),
    dev = String(b.device || "").slice(0, 64);
  if (!c.game.guestAllowed) throw fail(403, "지금은 게스트 입장이 막혀 있습니다");
  if (dev.length < 8) throw fail(400, "기기 정보가 없습니다");
  if (c.game.maintenance) throw fail(503, c.game.maintenanceMsg);
  let u = await getJ(guestKey(dev));
  // a new guest costs keys that never expire: 60 per address per ten minutes (a school or an internet cafe is one address); a device coming back is never counted
  if (!u && (await limited("guestnew:" + ip, GUEST_NEW_MAX, 600))) throw fail(429, "잠시 후 다시 시도하세요");
  if (!u) u = { id: "게스트" + (parseInt(crypto.createHash("md5").update(dev).digest("hex").slice(0, 6), 16) % 9000 + 1000), guest: !0, dev, created: now(), xp: 0, kills: 0, wins: 0, matches: 0 };
  u.id = await guestName(u.id, dev);
  ensureWallet(u, c);
  u.sessionVersion ||= crypto.randomBytes(16).toString("hex");
  const ban = await banOf(u, dev, ip);
  if (ban) throw Object.assign(fail(403, "이용이 제한되었습니다"), { ban });
  u.lastSeen = now();
  u.lastIp = ip;
  await saveUser(u);
  await log("guest", "게스트 입장: " + u.id, { ip, user: u.id });
  await ulog(u.id, "guest", "게스트 입장", { ip, dev });
  return { token: sign({ k: "p", id: dev, g: 1, v: u.sessionVersion, exp: now() + 30 * 864e5 }), user: publicUser(u, c.xp.perLevel), hist: histOf(u) };
};
A.me = async (q, b, req) => {
  const c = await loadConfig(),
    u = await who(b.token || q.token);
  if (!u) throw fail(401, "다시 로그인해 주세요");
  ensureWallet(u, c) && (await saveUser(u));
  if (u.owner && isOwnerId(u.id)) return { user: publicUser(u, c.xp.perLevel), atoken: sign({ k: "admin", pv: 2, exp: now() + 12 * 36e5 }), hist: histOf(u) };
  const ban = await banOf(u, u.dev, ipOf(req));
  if (ban) throw Object.assign(fail(403, "이용이 제한되었습니다"), { ban });
  return { user: publicUser(u, c.xp.perLevel), hist: histOf(u) };
};
// Only a scoped attestation travels to an untrusted room host.
const peerOk = (peer) => typeof peer === "string" && /^[A-Za-z0-9_-]{1,64}$/.test(peer);
const ownerScope = (room, peer) => typeof room === "string" && /^[A-Z0-9]{6}$/.test(room) && peerOk(peer);
A.owner_ticket = async (q, b) => {
  const u = await who(b.token);
  if (!u) throw fail(401, "다시 로그인해 주세요");
  if (!ownerScope(b.room, b.p)) throw fail(400, "방 또는 연결 정보가 이상합니다");
  // cheats are shut in a ranked room for everyone but the operator, whose matches count for RR as usual
  const rmo = await getJ("room:" + roomOf(b.room));
  if (!(u.owner && isOwnerId(u.id) && u._s.o === 1)) return rmo && rmo.ranked ? { ticket: null, ranked: !0 } : { ticket: null };
  const exp = Math.min(u._s.exp, now() + 5 * 60000);
  return { ticket: sign({ k: "owner", id: u.id, room: b.room, p: b.p, v: u.sessionVersion, exp }), exp };
};
A.owner_check = async (q, b) => {
  const s = verify(b.ticket);
  if (!ownerScope(b.room, b.p) || !s || s.k !== "owner" || s.room !== b.room || s.p !== b.p || !isOwnerId(s.id)) return { owner: false, id: null };
  const u = await getJ(userKey(s.id));
  const owner = !!(u && u.owner && u.sessionVersion === s.v);
  return { owner, id: owner ? u.id : null, exp: owner ? s.exp : 0 };
};
// A guest with cheats opened for its account shows them to the room host
// without handing over its sign-in: it asks for a ticket that says who it is,
// which room it is for and which peer asked (good for 6 hours), and the host
// asks what that account may do. A ticket is no use in any other room or from
// any other peer, so neither a host nor another guest can carry it elsewhere.
// A ticket without a peer (an old client) gets nothing. The answer is read
// fresh each time, so a change on the owner page counts at once, and a banned
// account has no cheats.
const roomOf = (v) => String(v || "").toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 8);
A.perm_ticket = async (q, b) => {
  const u = await who(b.token);
  if (!u) throw fail(401, "다시 로그인해 주세요");
  const rmp = await getJ("room:" + roomOf(b.room));
  if (rmp && rmp.ranked) return { ticket: null, ranked: !0 };
  return peerOk(b.p) && activePerm(u) ? { ticket: sign({ k: "perm", id: u.id, room: roomOf(b.room), p: b.p, exp: now() + 6 * 36e5 }) } : { ticket: null };
};
A.perm_check = async (q, b) => {
  const s = verify(b.ticket);
  if (!s || "perm" !== s.k || !s.id || !s.room || s.room !== roomOf(b.room) || !peerOk(s.p) || s.p !== b.p) return { perm: null, id: null };
  const u = await getJ(userKey(s.id));
  // the host is the one asking, so the ban is looked up with the account's own last address, not the host's
  if (u && !(u.owner && isOwnerId(u.id)) && (await banOf(u, u.dev, u.lastIp))) return { perm: null, id: null };
  return { perm: activePerm(u), id: u ? u.id : null };
};
// the gun skins a player picked follow the account: read them, or set the
// whole table (gun → skin name) with the time it was last changed, so the
// newer of two devices wins
A.skins = async (q, b) => {
  const c = await loadConfig(),
    u = await who(b.token);
  if (!u) throw fail(401, "다시 로그인해 주세요");
  let dirty = ensureWallet(u, c);
  const dropped = [],
    swap = {};
  if (b.set && "object" == typeof b.set) {
    const m = {};
    let n = 0;
    for (const k in b.set) {
      if (++n > 80) break;
      const v = String(b.set[k] || "").slice(0, 24);
      if (!/^[a-z0-9_]{1,24}$/.test(k) || !/^[a-z0-9_]{1,24}$/.test(v) || "default" === v) continue;
      hasItem(u, k, v) ? (m[k] = v) : dropped.push(k);
    }
    const t = Math.max(0, Math.min(now() + 6e4, +b.t || now()));
    if (!u.skins || t > u.skins.t) {
      const was = (u.skins && u.skins.m) || {};
      for (const k of new Set([...Object.keys(m), ...Object.keys(was)])) (m[k] || "default") !== (was[k] || "default") && Object.keys(swap).length < 8 && (swap[k] = m[k] || "default");
      u.skins = { t, m };
      dirty = !0;
    }
  }
  dirty && (await saveUser(u));
  Object.keys(swap).length && (await ulog(u.id, "equip", "스킨 장착 변경: " + Object.entries(swap).map(([g, s]) => g + "/" + s).join(", "), { sw: swap }));
  return { skins: u.skins || null, own: u.own, gold: u.gold, championCoins: u.championCoins, items: ITEMS, dropped };
};
// what a player wears, signed. In a room every player's skins travel with
// this ticket and the others show them only as the server signed them: the
// picks sent now (or the saved ones), owned items only, for one connection
// (the player's peer id), so a ticket copied from someone else is worth
// nothing. Checking needs no storage, only the signature.
A.skin_ticket = async (q, b) => {
  const u = await who(b.token);
  if (!u) throw fail(401, "다시 로그인해 주세요");
  if (await limited("skt:" + rlKey(u), 60, 60)) throw fail(429, "잠시 뒤에 다시 시도해 주세요");
  const src = isObj(b.m) ? b.m : (u.skins && isObj(u.skins.m) && u.skins.m) || {},
    p = String(b.p || "").slice(0, 64),
    m = {};
  if (!p) throw fail(400, "연결 정보가 없습니다");
  let n = 0;
  for (const k in src) {
    if (++n > 80) break;
    const v = String(src[k] || "").slice(0, 24);
    GUNS.includes(k) && hasItem(u, k, v) && (m[k] = v);
  }
  return { ticket: sign({ k: "skin", id: u.id, m, p, exp: now() + 12 * 36e5 }), m, p };
};
A.skin_check = async (q, b) => {
  const s = verify(b.ticket);
  return s && "skin" === s.k && isObj(s.m) && s.p ? { m: s.m, id: s.id, p: s.p } : { m: null, id: null, p: null };
};
// small things the game keeps per account: the touch-button layout (part →
// [x, y, size]); the newer of two devices wins, as with the skins
const TOUCH_PARTS = ["tb-fire", "tb-fire2", "tb-ads", "tb-jump", "tb-crouch", "tb-rel", "tb-use", "tb-nade", "tab-0", "tab-1", "tab-2", "tab-3", "mb-util", "mini"];
A.prefs = async (q, b) => {
  const u = await who(b.token);
  if (!u) throw fail(401, "다시 로그인해 주세요");
  if (isObj(b.set)) {
    const touch = {};
    const num = (v, lo, hi) => Math.max(lo, Math.min(hi, isFinite(+v) ? +v : lo));
    if (isObj(b.set.touch)) for (const k of TOUCH_PARTS) { const v = b.set.touch[k]; Array.isArray(v) && 3 === v.length && (touch[k] = [num(v[0], 0, 1), num(v[1], 0, 1), num(v[2], 0.4, 2.5)]); }
    const t = Math.max(0, Math.min(now() + 6e4, +b.t || now()));
    if (!u.prefs || t > u.prefs.t) { u.prefs = { t, touch }; await saveUser(u); }
  }
  return { prefs: u.prefs || null };
};

// ── feedback: bug reports, agent ideas, player reports, suggestions, reviews, questions ──
// Anyone signed in (an account or a guest) can send one; the owner reads them in the admin page and
// can mark where each one stands and write a short reply that the sender sees. Each lives in its own
// key for 90 days, newest first in the `fb` list (kept to the latest 3000).
const FB_TYPES = { bug: "버그 신고", agent: "요원 제안", report: "사용자 신고", idea: "추가했으면 하는 점 (제안)", review: "후기", ask: "문의", other: "기타" };
const FB_STATUS = ["new", "read", "doing", "done", "no"];
const FB_ROLES = ["타격대", "감시자", "척후대", "전략가"];
const FB_REASONS = ["cheat", "abuse", "grief", "afk", "name", "other"];
const FB_KEYS = ["Q", "E", "C", "X"];
const fbStr = (v, n) => String(v == null ? "" : v).replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f]/g, "").trim().slice(0, n);
// The connection story a guest's game saves when a multiplayer link breaks (js/legacy/110-…): at most 40 lines of
// times, states, candidate TYPES, protocol and round-trip time. Every field is checked against a fixed shape; anything
// else (addresses, server lists, free text) is dropped, so an address can never be stored through here.
const ICE_REASONS = ["failed", "disconnected", "host-gone"], ICE_TYPES = ["host", "srflx", "prflx", "relay"], ICE_ROLES = ["host", "client", "solo", "-"], ICE_STATES = ["new", "checking", "connected", "completed", "failed", "disconnected", "closed"];
function cleanIce(v) {
  if (!isObj(v) || !Array.isArray(v.lines)) return null;
  const n = (x, max) => (Number.isFinite(x) ? Math.max(0, Math.min(max, Math.round(x))) : 0);
  const lines = [];
  for (const l of v.lines.slice(-200)) {
    if (!isObj(l)) continue;
    const ev = typeof l.ev === "string" && /^(created|gathered|closed-by-app|route-error|(ice|conn|route):[a-z]{3,12})$/.test(l.ev) ? l.ev : "";
    if (!ev) continue;
    const o = { t: typeof l.t === "string" && /^\d{4}-\d\d-\d\dT\d\d:\d\d:\d\d(\.\d{1,3})?Z?$/.test(l.t) ? l.t : "", pc: typeof l.pc === "string" && /^pc\d{1,5}$/.test(l.pc) ? l.pc : "", role: ICE_ROLES.includes(l.role) ? l.role : "-", ev };
    if (ICE_TYPES.includes(l.local)) o.local = l.local;
    if (ICE_TYPES.includes(l.remote)) o.remote = l.remote;
    if (l.proto === "udp" || l.proto === "tcp") o.proto = l.proto;
    if (Number.isFinite(l.rtt)) o.rtt = n(l.rtt, 60000);
    if (ICE_STATES.includes(l.ice)) o.ice = l.ice;
    if (Number.isFinite(l.servers)) o.servers = n(l.servers, 20);
    if (Number.isFinite(l.turn)) o.turn = n(l.turn, 20);
    for (const k of ICE_TYPES) if (Number.isFinite(l[k]) && l[k] > 0) o[k] = n(l[k], 999);
    lines.push(o);
  }
  return lines.length ? { reason: ICE_REASONS.includes(v.reason) ? v.reason : "failed", lines: lines.slice(-40) } : null;
}
function cleanFeedback(b) {
  // only a string that is one of the types: not an inherited key ("constructor", "__proto__") and not an array that coerces to one
  const type = typeof b.type === "string" && Object.hasOwn(FB_TYPES, b.type) ? b.type : "";
  if (!type) throw fail(400, "종류를 골라 주세요");
  const text = fbStr(b.text, 2000);
  if (text.length < 5) throw fail(400, "내용을 5자 이상 적어 주세요");
  const f = { type, title: fbStr(b.title, 60), text, contact: fbStr(b.contact, 80) };
  if ("agent" === type) {
    const a = isObj(b.agent) ? b.agent : {};
    const abilities = (Array.isArray(a.abilities) ? a.abilities : []).slice(0, 4).map((x, i) => ({ key: FB_KEYS[i], name: fbStr(isObj(x) ? x.name : "", 24), desc: fbStr(isObj(x) ? x.desc : "", 300) })).filter((x) => x.name || x.desc);
    f.agent = { name: fbStr(a.name, 20), role: FB_ROLES.includes(a.role) ? a.role : "", abilities };
    if (!f.agent.name) throw fail(400, "요원 이름을 적어 주세요");
    if (!abilities.length) throw fail(400, "능력을 하나 이상 설명해 주세요");
  }
  if ("report" === type) {
    const r = isObj(b.report) ? b.report : {};
    f.report = { target: fbStr(r.target, 30), reason: FB_REASONS.includes(r.reason) ? r.reason : "other", room: fbStr(r.room, 8).toUpperCase() };
    if (!f.report.target) throw fail(400, "신고할 사용자의 이름을 적어 주세요");
  }
  if ("bug" === type) {
    const g = isObj(b.bug) ? b.bug : {};
    f.bug = { where: fbStr(g.where, 30), steps: fbStr(g.steps, 600) };
  }
  if ("review" === type) {
    // an optional star rating: 1 to 5 (more is five, less than one is none); only a review carries one
    const n = Number(b.rating);
    if (n >= 1) f.rating = Math.min(5, Math.round(n));
  }
  // no title: the agent's name, the reported name, or the first words
  f.title ||= "agent" === type ? "요원 제안: " + f.agent.name : "report" === type ? "신고: " + f.report.target : text.replace(/\s+/g, " ").slice(0, 40);
  const c = isObj(b.ctx) ? b.ctx : {};
  f.ctx = { ua: fbStr(c.ua, 160), view: fbStr(c.view, 20), page: fbStr(c.page, 20), mode: fbStr(c.mode, 20), map: fbStr(c.map, 24), lang: fbStr(c.lang, 4) };
  if (isObj(c.diagnostic)) {
    const d=c.diagnostic,number=(v,max)=>Number.isFinite(v)?Math.max(0,Math.min(max,Math.round(v*10)/10)):0;
    f.ctx.diagnostic={version:fbStr(d.version,30),commit:/^[a-f0-9]{40}$/.test(d.commit)?d.commit:'local',quality:['mobile','perf','visual','ultra'].includes(d.quality)?d.quality:'unknown',medianMs:number(d.medianMs,1000),p95Ms:number(d.p95Ms,1000),geometries:number(d.geometries,1e6),textures:number(d.textures,1e6)};
  }
  if ("bug" === type && isObj(c.ice)) {
    const ice = cleanIce(c.ice);
    if (ice) f.ctx.ice = ice;
  }
  return f;
}
A.feedback_submit = async (q, b) => {
  const u = await who(b.token);
  if (!u) throw fail(401, "다시 로그인해 주세요");
  const f = cleanFeedback(b),
    me = u.guest ? "g:" + u.dev : "u:" + u.id.toLowerCase();
  if ((await limited("fb:" + me + ":h", 5, 3600)) || (await limited("fb:" + me + ":d", 15, 86400))) throw fail(429, "문의를 너무 자주 보내고 있습니다. 잠시 후 다시 시도해 주세요");
  // the same words twice in ten minutes are one
  if (await limited("fbdup:" + crypto.createHash("md5").update(me + "|" + f.type + "|" + f.text).digest("hex"), 1, 600)) throw fail(409, "같은 내용을 방금 보내셨습니다");
  const c = await loadConfig(),
    id = now().toString(36) + crypto.randomBytes(3).toString("hex");
  const rec = Object.assign({ id, t: now(), by: { id: u.id, guest: !!u.guest, level: levelOf(u.xp || 0, c.xp.perLevel).level }, status: "new", note: "", reply: "", replyT: 0 }, f);
  await pipe([
    ["SET", "fb:" + id, JSON.stringify(rec), "EX", String(90 * 86400)],
    ["LPUSH", "fb", id],
    ["LTRIM", "fb", "0", "2999"],
    ["LPUSH", "fbu:" + me, id],
    ["LTRIM", "fbu:" + me, "0", "19"],
    ["EXPIRE", "fbu:" + me, String(90 * 86400)],
  ]);
  await log("feedback", `${FB_TYPES[f.type]} · ${u.id}: ${f.title}`, { id, user: u.id });
  return { id };
};
// what I sent, with where each stands and the reply
A.feedback_mine = async (q, b) => {
  const u = await who(b.token);
  if (!u) throw fail(401, "다시 로그인해 주세요");
  const me = u.guest ? "g:" + u.dev : "u:" + u.id.toLowerCase(),
    ids = await redis(["LRANGE", "fbu:" + me, "0", "19"]);
  const rows = ids.length ? await pipe(ids.map((i) => ["GET", "fb:" + i])) : [];
  return { items: rows.filter(Boolean).map((r) => { const x = JSON.parse(r); return { id: x.id, t: x.t, type: x.type, title: x.title, status: x.status, reply: x.reply || "", replyT: x.replyT || 0 }; }) };
};

// ── paid cheats by bank transfer ──
// A player picks cheats and a length, the order gets a short code and the account to pay into (the
// owner sets it in the settings), and the owner opens the cheats on the account from the admin page
// once the money is in. Opening merges into the account's own cheat permission (`perm`), the one the
// owner can already give by hand; a ranked match never honours it.
const ORDER_ITEMS = [
  { k: "radar", name: "레이더", desc: "작은 지도에 적이 보입니다", sw: 1 },
  { k: "wall", name: "벽 투시", desc: "벽 너머의 적이 보입니다", sw: 1 },
  { k: "cheat", name: "치트 모드", desc: "능력이 다시 차고 다른 요원의 능력 세트를 씁니다", sw: 1 },
  { k: "oneShot", name: "한 방 처치", desc: "총 한 발에 쓰러뜨립니다", sw: 1 },
  { k: "infAmmo", name: "탄약 무한", desc: "재장전 없이 쏩니다", sw: 1 },
  { k: "noRecoil", name: "반동 없음", desc: "총이 튀지 않습니다", sw: 1 },
  { k: "speed", name: "이동 속도 ×1.5", desc: "더 빨리 달립니다" },
  { k: "fastFire", name: "연사 ×2", desc: "총을 두 배 빨리 쏩니다" },
  { k: "buff", name: "능력 재충전 10초", desc: "궁극기 말고는 10초마다 다시 찹니다" },
  // gold: paid once, no length, added to the account when the owner opens the order
  { k: "gold1k", name: "골드 1,000", desc: "상점과 뽑기에 쓰는 골드", gold: 1000 },
  { k: "gold5k", name: "골드 5,000", desc: "상점과 뽑기에 쓰는 골드", gold: 5000 },
  { k: "gold20k", name: "골드 20,000", desc: "상점과 뽑기에 쓰는 골드", gold: 20000 },
];
// no longer sold, still named in the orders already made
const ORDER_LEGACY = { god: "무적" };
const orderNames = () => Object.assign({}, ORDER_LEGACY, Object.fromEntries(ORDER_ITEMS.map((x) => [x.k, x.name])));
const goldOf = (k) => (ORDER_ITEMS.find((x) => x.k === k) || {}).gold || 0;
// admin mode is never sold: the owner gives it to an account by hand (and with it every cheat)
const orderPick = (list) => {
  const known = new Set(ORDER_ITEMS.map((x) => x.k));
  return [...new Set((Array.isArray(list) ? list : []).map(String))].filter((k) => known.has(k));
};
const ORDER_DUR = [{ id: "d1", days: 1, label: "1일" }, { id: "d7", days: 7, label: "7일" }, { id: "d30", days: 30, label: "30일" }, { id: "d0", days: 0, label: "영구" }];
const ORDER_STATUS = ["pending", "granted", "rejected", "cancelled", "refunded", "revoked"];
const orderTotal = (c, items, days) => {
  const dur = ORDER_DUR.find((d) => d.days === days);
  if (!dur) return 0;
  const sum = (ks) => ks.reduce((n, k) => n + (c.order.price[k] || 0), 0);
  // the cheats are priced by length; gold is paid once
  return Math.round((sum(items.filter((k) => !goldOf(k))) * (c.order.dur[dur.id] || 0)) / 100) * 100 + sum(items.filter(goldOf));
};
const orderCatalog = (c) => ({ items: ORDER_ITEMS.map((x) => ({ k: x.k, name: x.name, desc: x.desc, price: c.order.price[x.k] || 0, gold: x.gold || 0 })), legacy: ORDER_LEGACY, durations: ORDER_DUR.map((d) => ({ days: d.days, label: d.label, mult: c.order.dur[d.id] || 0 })) });
const orderPay = (c) => ({ bank: c.order.bank, holder: c.order.holder, note: c.order.note });
const orderMe = (u) => "u:" + u.id.toLowerCase();
const cleanDeposit = (v) => String(v == null ? "" : v).replace(/[\u0000-\u001f]/g, "").trim().slice(0, 20);
// The books of the paid orders: one line for each thing that happened (order made, money confirmed and opened,
// taken back, refunded, declined, cancelled), kept for good. `money` is what moved in (+) or out (-) in won.
const LEDGER_KINDS = ["order", "paid", "revoke", "refund", "reject", "cancel"];
const ledgerLine = (kind, o, extra) => JSON.stringify(Object.assign({ t: now(), kind, id: o.id, user: o.by, items: o.items, days: o.days, total: o.total, depositor: o.depositor, money: 0 }, extra));
const ledgerAdd = (kind, o, extra) => pipe([["LPUSH", "ledger", ledgerLine(kind, o, extra)], ["LTRIM", "ledger", "0", "19999"]]);
// One order changes status one request at a time: a short lock per order (the owner's grant, refund, revoke and the
// player's own cancel all take it), released only while it is still ours. Whoever finds it taken gets a 409.
const ORDER_UNLOCK = `if redis.call('GET', KEYS[1]) == ARGV[1] then return redis.call('DEL', KEYS[1]) end
return 0`;
async function withOrderLock(id, fn) {
  const lock = "ordlock:" + id, nonce = crypto.randomBytes(12).toString("hex");
  if ((await redis(["SET", lock, nonce, "NX", "EX", "30"])) === null) throw fail(409, "이 주문을 다른 요청이 처리 중입니다. 잠시 후 다시 시도해 주세요");
  try { return await fn(); }
  finally { try { await redis(["EVAL", ORDER_UNLOCK, "1", lock, nonce]); } catch (e) {} }
}
// the first time the books are opened, the orders made before them are written in (oldest first)
async function ledgerSeed() {
  if ((await redis(["LRANGE", "ledger", "0", "0"])).length) return;
  const ids = await redis(["LRANGE", "ord", "0", "1999"]);
  const rows = ids.length ? (await pipe(ids.map((i) => ["GET", "ord:" + i]))).filter(Boolean).map((x) => JSON.parse(x)) : [];
  const lines = [];
  for (const o of rows.sort((a, b) => a.t - b.t)) {
    lines.push(ledgerLine("order", o, { t: o.t }));
    if (o.grantedAt) lines.push(ledgerLine("paid", o, { t: o.grantedAt, money: o.total }));
    if ("refunded" === o.status) lines.push(ledgerLine("refund", o, { t: o.refundedAt || o.grantedAt || o.t, money: o.grantedAt ? -o.total : 0, reason: o.reason || "" }));
    if ("revoked" === o.status) lines.push(ledgerLine("revoke", o, { t: o.revokedAt || o.grantedAt || o.t, reason: o.reason || "" }));
    if ("rejected" === o.status) lines.push(ledgerLine("reject", o, { t: o.t, reason: o.reason || "" }));
    if ("cancelled" === o.status) lines.push(ledgerLine("cancel", o, { t: o.t }));
  }
  for (const l of lines) await redis(["LPUSH", "ledger", l]);
}
// What an order gave is taken back, and only this order's part of it.
//  - gold: the whole sum the order gave comes off, even if it is already spent; the balance may go below nothing
//    (a debt the account earns back; every spend checks gold >= price, so nothing can be bought until it is paid off).
//  - cheats: a cheat goes off only if no OTHER granted, unexpired order of the account also grants it.
//  - perm.until: if another remaining order is permanent (days 0) the account stays permanent. Otherwise this order's
//    own extension is removed: a timed order undoes its days (exactly, back to `prevUntil` recorded when it was
//    opened, if it is still the last extension; else it subtracts its days; at or below now only the other orders' expiry keeps cheats on); an order that made the
//    account permanent leaves the latest expiry of the remaining orders, or switches the cheats off if none remain.
//    An order that has already run out leaves `until` alone (its days are used up). While the owner's admin mode
//    lends its own full set (permAdmin), the account's own cheats underneath (permBefore) are the ones changed.
// Orders are read from the account's order index (ordu:, the latest 200); older ones are not counted.
const ordExp = (o) => (0 === o.days ? 0 : Number.isFinite(o.exp) ? o.exp : o.until > 0 ? o.until : (o.grantedAt || o.t || 0) + o.days * 864e5);
async function takeBackOrder(u, o) {
  const cheats = o.items.filter((k) => !goldOf(k));
  if (cheats.length) {
    const t = now(), ids = await redis(["LRANGE", "ordu:" + orderMe(u), "0", "199"]);
    const rows = ids.length ? (await pipe(ids.map((i) => ["GET", "ord:" + i]))).filter(Boolean).map((x) => JSON.parse(x)) : [];
    const others = rows.filter((x) => x.id !== o.id && "granted" === x.status && x.items.some((k) => !goldOf(k)) && (0 === x.days || ordExp(x) > t));
    const keep = new Set(others.flatMap((x) => x.items));
    const permanent = others.some((x) => 0 === x.days);
    const latest = others.reduce((n, x) => Math.max(n, ordExp(x)), 0);
    const expired = o.days > 0 && ordExp(o) <= t;
    const fix = (perm) => {
      if (!isObj(perm)) return perm;
      const p = Object.assign({}, perm);
      for (const k of cheats) {
        if (keep.has(k)) continue;
        if (PERM_SW.includes(k)) p[k] = !1;
        else if ("speed" === k) p.speed = 1;
        else if ("fastFire" === k) p.fastFire = 1;
        else if ("buff" === k) p.buff = 0;
      }
      p.on = !!p.on && (PERM_SW.some((k) => p[k]) || p.speed > 1 || p.fastFire > 1 || p.buff > 0);
      if (permanent) p.until = 0;
      else if (!expired && p.on) {
        if (0 === o.days) {
          // this order made the account permanent: whatever the others still run to
          if (latest > t) p.until = latest;
          else p.on = !1;
        } else if (p.until > 0) {
          const to = Number.isFinite(o.prevUntil) && o.prevUntil > 0 && p.until === o.until ? o.prevUntil : p.until - o.days * 864e5;
          // nothing of this order's time is left: only what the other orders still run to keeps the cheats on
          if (to > t) p.until = to;
          else if (latest > t) p.until = latest;
          else p.on = !1;
        }
      }
      return p;
    };
    if (u.permAdmin) u.permBefore && (u.permBefore = fix(u.permBefore));
    else u.perm = fix(u.perm);
  }
  const g = o.items.reduce((n, k) => n + goldOf(k), 0);
  g && (u.gold = (+u.gold || 0) - g);
}
A.order_info = async () => {
  const c = await loadConfig();
  return Object.assign({ on: !!c.order.on }, orderCatalog(c));
};
A.order_create = async (q, b) => {
  const u = await who(b.token),
    c = await loadConfig();
  if (!u) throw fail(401, "다시 로그인해 주세요");
  if (u.guest) throw fail(403, "게스트는 구매할 수 없습니다. 계정을 만들어 주세요");
  if (!c.order.on) throw fail(403, "지금은 판매하지 않습니다");
  if (!c.order.bank) throw fail(503, "입금 계좌가 아직 정해지지 않았습니다");
  const items = orderPick(b.items);
  if (!items.length) throw fail(400, "원하는 상품을 하나 이상 골라 주세요");
  const days = +b.days;
  if (!ORDER_DUR.some((d) => d.days === days)) throw fail(400, "기간을 골라 주세요");
  const depositor = cleanDeposit(b.depositor) || u.id;
  const total = orderTotal(c, items, days);
  if (total <= 0) throw fail(400, "가격이 정해지지 않았습니다");
  const me = orderMe(u);
  if (await limited("ord:" + me + ":d", 10, 86400)) throw fail(429, "오늘은 더 주문할 수 없습니다");
  const ids = await redis(["LRANGE", "ordu:" + me, "0", "19"]);
  const mine = ids.length ? (await pipe(ids.map((i) => ["GET", "ord:" + i]))).filter(Boolean).map((x) => JSON.parse(x)) : [];
  if (mine.filter((o) => "pending" === o.status).length >= 3) throw fail(409, "입금 확인을 기다리는 주문이 이미 3건 있습니다");
  const id = Array.from(crypto.randomBytes(6), (x) => "ABCDEFGHJKMNPQRSTUVWXYZ23456789"[x % 31]).join("");
  const rec = { id, t: now(), by: u.id, items, days, total, depositor, status: "pending", note: "", reason: "" };
  await pipe([
    ["SET", "ord:" + id, JSON.stringify(rec), "EX", String(400 * 86400)],
    ["LPUSH", "ord", id],
    ["LTRIM", "ord", "0", "1999"],
    ["LPUSH", "ordu:" + me, id],
    ["LTRIM", "ordu:" + me, "0", "199"],
  ]);
  await ledgerAdd("order", rec);
  await log("order", `주문 ${id} · ${u.id} · ${items.join(",")} · ${days || "영구"}일 · ${total}원`, { id, user: u.id });
  return { order: rec, pay: orderPay(c) };
};
A.order_mine = async (q, b) => {
  const u = await who(b.token),
    c = await loadConfig();
  if (!u) throw fail(401, "다시 로그인해 주세요");
  const ids = await redis(["LRANGE", "ordu:" + orderMe(u), "0", "19"]);
  const orders = ids.length ? (await pipe(ids.map((i) => ["GET", "ord:" + i]))).filter(Boolean).map((x) => JSON.parse(x)) : [];
  return { orders: orders.map((o) => ({ id: o.id, t: o.t, items: o.items, days: o.days, total: o.total, depositor: o.depositor, status: o.status, reason: o.reason || "", until: o.until || 0 })), pay: orders.some((o) => "pending" === o.status) ? orderPay(c) : null, perm: activePerm(u) };
};
A.order_cancel = async (q, b) => {
  const u = await who(b.token);
  if (!u) throw fail(401, "다시 로그인해 주세요");
  const id = String(b.id || "").toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 8);
  if (!id) throw fail(404, "없는 주문입니다");
  return withOrderLock(id, async () => {
    const raw = await redis(["GET", "ord:" + id]);
    if (!raw) throw fail(404, "없는 주문입니다");
    const o = JSON.parse(raw);
    if (o.by.toLowerCase() !== u.id.toLowerCase()) throw fail(403, "내 주문이 아닙니다");
    if ("pending" !== o.status) throw fail(409, "이미 처리된 주문입니다");
    o.status = "cancelled";
    // the new status is written first: a failed ledger line can never let a retry act on the old one
    await redis(["SET", "ord:" + id, JSON.stringify(o), "EX", String(400 * 86400)]);
    await ledgerAdd("cancel", o);
    await ulog(u.id, "order", `주문 ${id} 취소`, { id });
    return { ok: !0 };
  });
};
// the account's cheat end before an order is opened (0 = permanent or none) and the order's own end (0 = never)
function orderEnds(u, o) {
  const own = ownPerm(u), cur = own && own.on && !(own.until && own.until < now()) ? own : null;
  return { until: cur ? cur.until || 0 : 0, exp: 0 === o.days ? 0 : (cur && cur.until > now() ? cur.until : now()) + o.days * 864e5 };
}
// opening what was paid for: cheats merged into those the account already has, the length added on; gold is added to the wallet
function applyOrder(u, o) {
  const gold = o.items.reduce((n, k) => n + goldOf(k), 0),
    cheats = o.items.filter((k) => !goldOf(k));
  const own = ownPerm(u);
  let out = own;
  if (cheats.length) {
    const cur = own && own.on && !(own.until && own.until < now()) ? own : null,
      p = Object.assign({}, cur || {});
    for (const k of cheats) {
      const it = ORDER_ITEMS.find((x) => x.k === k);
      if (!it) continue;
      if (it.sw) p[k] = !0;
      else if ("speed" === k) p.speed = Math.max(+p.speed || 1, 1.5);
      else if ("fastFire" === k) p.fastFire = Math.max(+p.fastFire || 1, 2);
      else if ("buff" === k) p.buff = Math.max(+p.buff || 0, 10);
    }
    p.on = !0;
    out = cleanPerm(p, 0);
    // permanent stays permanent; else from now, or from the end of what is running
    out.until = o.days === 0 || (cur && !cur.until) ? 0 : (cur && cur.until > now() ? cur.until : now()) + o.days * 864e5;
    setOwnPerm(u, out);
  }
  if (gold) u.gold = Math.min(9e6, (+u.gold || 0) + gold);
  return out;
}
// the catalogue: which guns and skins a pull can give (the game checks it matches its own)
A.catalog = async () => ({ guns: GUNS, tiers: SKIN_TIER, only: SKIN_ONLY, items: ITEMS });
// Transcendent skins have a separate earned currency, never a gold price or random pull.
const CHAMPION_PRICE = 700;
const championItems = () => SKIN_IDS.filter((s) => SKIN_TIER[s] === 5 && EXCLUSIVE[s] === "coins").map((s) => ({ g: SKIN_ONLY[s], s, r: 5, price: CHAMPION_PRICE }));
A.champion_shop = async (q, b) => {
  const c = await loadConfig(), u = b.token ? await who(b.token) : null;
  if (b.token && !u) throw fail(401, "다시 로그인해 주세요");
  if (u && ensureWallet(u, c)) await saveUser(u);
  return { offers: championItems(), championCoins: u ? u.championCoins : null, own: u ? u.own : {}, gold: u ? u.gold : null, items: ITEMS };
};
A.champion_buy = async (q, b) => {
  const c = await loadConfig(), u = await who(b.token);
  if (!u) throw fail(401, "다시 로그인해 주세요");
  if (await limited("championbuy:" + rlKey(u), 10, 10)) throw fail(429, "너무 빨리 눌렀습니다");
  ensureWallet(u, c);
  const item = championItems().find((x) => x.g === b.g && x.s === b.s);
  if (!item) throw fail(400, "초월 상점에 없는 스킨입니다");
  if (hasItem(u, item.g, item.s)) throw fail(409, "이미 보유한 스킨입니다");
  if (u.championCoins < CHAMPION_PRICE) throw fail(402, "초월 코인이 부족합니다 (700개 필요)");
  u.championCoins -= CHAMPION_PRICE;
  (u.own[item.g] = u.own[item.g] || []).push(item.s);
  await saveUser(u);
  await log("shop", `${u.id} 초월 스킨 구매: ${item.g}/${item.s} · 초월 코인 ${CHAMPION_PRICE}개`, { user: u.id });
  await ulog(u.id, "shop", `초월 스킨 구매: ${item.g}/${item.s} · 초월 코인 ${CHAMPION_PRICE}개`, { g: item.g, s: item.s, r: 5, coins: -CHAMPION_PRICE, cc: u.championCoins });
  return { item, championCoins: u.championCoins, own: u.own, gold: u.gold, items: ITEMS, user: publicUser(u, c.xp.perLevel) };
};

// ── profile cosmetics ──
// slot title / card / banner, tier 1-4. The names and looks are in js/cosmetics.js (a test checks the ids
// and tiers match); the server decides who owns what and what is on.
const COS = [];
const cosAdd = (s, r, ids) => ids.split(" ").forEach((id) => COS.push({ id, s, r }));
cosAdd("title", 1, "rookie scout patrol scrap recruit lookout fieldmedic sprinter tinker sentry");
cosAdd("title", 2, "marksman bulwark shade tempest tracker ambusher breacher brawler nightowl hawkeye rescuer demolition");
cosAdd("title", 3, "commander deadeye phoenix wraith vanguard lastline clutch silentfox webacrobat hospghost harbormaster");
cosAdd("title", 4, "legend13 sovereign flawless unbroken thirteenth grandmaster avatar13 apex");
cosAdd("card", 1, "snow dusk forest harbor concrete sandstorm");
cosAdd("card", 2, "neoncity dancheong rooftopc wardhall carbon bluehour tacmap");
cosAdd("card", 3, "galaxy magma thunder bloodmoon abyss circuit");
cosAdd("card", 4, "laurelc aurorac prism eclipsec royalc");
cosAdd("banner", 2, "gold bolt sakura");
cosAdd("banner", 3, "neonpink flame frost");
cosAdd("banner", 4, "ink stars");
// no prototype: a request's id of "constructor" or "__proto__" must find nothing
const COS_BY = Object.assign(Object.create(null), Object.fromEntries(COS.map((x) => [x.id, x])));
const cosPrice = (c, x) => Math.max(0, Math.round(+(c.cos && c.cos.price && c.cos.price[x.r]) || 0));
const cosOf = (u) => {
  const o = isObj(u.cos) ? u.cos : {},
    own = (Array.isArray(o.own) ? o.own : []).filter((id) => COS_BY[id]),
    eq = {};
  for (const x of ["title", "card", "banner"]) eq[x] = isObj(o.eq) && COS_BY[o.eq[x]] && COS_BY[o.eq[x]].s === x && own.includes(o.eq[x]) ? o.eq[x] : "";
  return { own, eq };
};
A.cos = async (q, b) => {
  const c = await loadConfig();
  const u = b && b.token ? await who(b.token).catch(() => null) : null;
  const me = u ? cosOf(u) : { own: [], eq: { title: "", card: "", banner: "" } };
  return { on: !!c.cos.on, items: COS.map((x) => ({ id: x.id, s: x.s, r: x.r, price: cosPrice(c, x) })), own: me.own, eq: me.eq, gold: u && "number" == typeof u.gold ? u.gold : null };
};
A.cos_buy = async (q, b) => {
  const c = await loadConfig(),
    u = await who(b.token);
  if (!u) throw fail(401, "다시 로그인해 주세요");
  if (await limited("cos:" + rlKey(u), 20, 10)) throw fail(429, "너무 빨리 눌렀습니다");
  if (!c.cos.on) throw fail(403, "지금은 꾸미기 상점이 닫혀 있습니다");
  ensureWallet(u, c);
  const x = COS_BY[String(b.id)];
  if (!x) throw fail(404, "없는 아이템입니다");
  const me = cosOf(u);
  if (me.own.includes(x.id)) throw fail(409, "이미 가진 아이템입니다");
  const price = cosPrice(c, x);
  if (u.gold < price) throw fail(402, `골드가 부족합니다 (${price.toLocaleString()} 필요)`);
  u.gold -= price;
  u.cos = { own: me.own.concat(x.id), eq: me.eq };
  u.spent = (u.spent || 0) + price;
  u.cosBought = (u.cosBought || 0) + 1;
  await saveUser(u);
  await log("shop", `${u.id} 꾸미기 구매: ${x.s}/${x.id} (${["", "일반", "희귀", "영웅", "전설"][x.r]}) ${price}골드`, { user: u.id });
  await ulog(u.id, "cos", `꾸미기 구매: ${x.s}/${x.id} (${["", "일반", "희귀", "영웅", "전설"][x.r]}) ${price}골드`, { slot: x.s, id: x.id, r: x.r, price, dg: -price, gold: u.gold });
  return { item: x.id, gold: u.gold, own: u.cos.own, eq: u.cos.eq, user: publicUser(u, c.xp.perLevel) };
};
A.cos_equip = async (q, b) => {
  const c = await loadConfig(),
    u = await who(b.token);
  if (!u) throw fail(401, "다시 로그인해 주세요");
  if (await limited("cosq:" + rlKey(u), 40, 10)) throw fail(429, "너무 빨리 눌렀습니다");
  const slot = String(b.slot);
  if (!["title", "card", "banner"].includes(slot)) throw fail(400, "없는 칸입니다");
  const me = cosOf(u),
    id = b.id ? String(b.id) : "";
  if (id && !(COS_BY[id] && COS_BY[id].s === slot)) throw fail(400, "이 칸에 맞지 않는 아이템입니다");
  if (id && !me.own.includes(id)) throw fail(403, "가지고 있지 않은 아이템입니다");
  const prevEq = me.eq[slot];
  me.eq[slot] = id;
  u.cos = { own: me.own, eq: me.eq };
  await saveUser(u);
  prevEq !== id && (await ulog(u.id, "cos", id ? `꾸미기 장착: ${slot}/${id}` : `꾸미기 해제: ${slot}`, { slot, id }));
  return { own: me.own, eq: me.eq, user: publicUser(u, c.xp.perLevel) };
};
// ── the daily shop ──
// The day starts at midnight in Korea. The twenty items come from a hash of the day (and
// the owner's reroll number) keyed with the server secret, so everyone sees the same shop,
// nobody can work out tomorrow's, and the server works today's out again to check a buy.
const nextKstMidnight = (t) => {
  const d = new Date(t + 9 * 36e5);
  d.setUTCHours(24, 0, 0, 0);
  return d.getTime() - 9 * 36e5;
};
const shopPrice = (c, g, s) => Math.max(0, Math.round((+c.shop.price[TIER_KEYS[SKIN_TIER[s] - 1]] || 0) * (SKIN_ONLY[s] === "knife" ? Math.max(1, +c.shop.knife || 1) : 1)));
function shopOf(c, day) {
  // Exclude weekly deals before selecting each tier, so a collision does not
  // reduce the configured number of daily offers after weapon-pool changes.
  const weeklyKeys = new Set(weeklyOf(c, kstWeek(Date.parse(day + "T12:00:00+09:00"))).map(x => x.g + "|" + x.s));
  const out = [],
    usedGun = new Set(),
    usedSkin = {};
  TIER_KEYS.forEach((tk, ti) => {
    const want = Math.max(0, Math.floor(+c.shop.mix[tk] || 0));
    if (!want) return;
    const h = crypto.createHmac("sha256", SECRET).update(`shop|${day}|${c.shop.reroll | 0}|${tk}`).digest();
    let st = h.readUInt32LE(0) >>> 0 || 1;
    const rnd = () => ((st = (st * 1664525 + 1013904223) >>> 0), st / 4294967296);
    const pool = [];
    for (const s of SKIN_IDS) if (SKIN_TIER[s] === ti + 1 && !EXCLUSIVE[s]) for (const g of GUNS) fits(s, g) && !weeklyKeys.has(g + "|" + s) && pool.push([g, s]);
    for (let i = pool.length - 1; i > 0; i--) {
      const j = Math.floor(rnd() * (i + 1));
      [pool[i], pool[j]] = [pool[j], pool[i]];
    }
    // a spread: a gun once and a skin at most twice while the pool allows, then whatever is left
    const picked = [];
    for (const [g, s] of pool) {
      if (picked.length >= want) break;
      if (usedGun.has(g) || (usedSkin[s] || 0) >= 2) continue;
      picked.push([g, s]);
      usedGun.add(g);
      usedSkin[s] = (usedSkin[s] || 0) + 1;
    }
    for (const it of pool) if (picked.length < want && !picked.includes(it)) picked.push(it);
    for (const [g, s] of picked) out.push({ g, s, r: ti + 1, price: shopPrice(c, g, s) });
  });
  return out;
}
// ── the weekly deal ──
// From Monday (Korea) to the next: epic and legendary skins at a discount, picked from the week
// and the owner's weekly reroll number the same way as the daily twenty. Skins only a season gives
// are never in it.
const nextKstMonday = (t) => Date.parse(kstWeek(t) + "T00:00:00+09:00") + 7 * 864e5;
function weeklyOf(c, week) {
  const W = c.shop.weekly;
  if (!W || !W.on) return [];
  const out = [],
    off = Math.max(0, Math.min(90, +W.off || 0));
  for (const tk of ["epic", "legendary", "transcendent"]) {
    const ti = TIER_KEYS.indexOf(tk),
      want = Math.max(0, Math.floor(+(W.mix && W.mix[tk]) || 0));
    if (!want) continue;
    const h = crypto.createHmac("sha256", SECRET).update(`weekly|${week}|${W.reroll | 0}|${tk}`).digest();
    let st = h.readUInt32LE(0) >>> 0 || 1;
    const rnd = () => ((st = (st * 1664525 + 1013904223) >>> 0), st / 4294967296);
    const pool = [];
    for (const s of SKIN_IDS) if (SKIN_TIER[s] === ti + 1 && !EXCLUSIVE[s]) for (const g of GUNS) fits(s, g) && pool.push([g, s]);
    for (let i = pool.length - 1; i > 0; i--) {
      const j = Math.floor(rnd() * (i + 1));
      [pool[i], pool[j]] = [pool[j], pool[i]];
    }
    // a gun once and a skin at most once while the pool allows
    const usedGun = new Set(out.map((x) => x.g)),
      usedSkin = new Set(out.map((x) => x.s)),
      picked = [];
    for (const [g, s] of pool) {
      if (picked.length >= want) break;
      if (usedGun.has(g) || usedSkin.has(s)) continue;
      picked.push([g, s]);
      usedGun.add(g);
      usedSkin.add(s);
    }
    for (const [g, s] of picked) {
      const was = shopPrice(c, g, s);
      out.push({ g, s, r: ti + 1, was, price: Math.round((was * (100 - off)) / 100 / 10) * 10, w: 1 });
    }
  }
  return out;
}
A.shop = async (q, b) => {
  const c = await loadConfig(),
    t = now(),
    day = kstDay(t);
  const u = b && b.token ? await who(b.token).catch(() => null) : null;
  const weekly = c.shop.on ? weeklyOf(c, kstWeek(t)) : [];
  // a skin in the weekly deal is not also in the day's list
  const items = (c.shop.on ? shopOf(c, day) : []).filter((x) => !weekly.some((w) => w.g === x.g && w.s === x.s));
  const wish = u ? cleanWish(u) : [];
  const mark = (x) => Object.assign(x, { own: u ? hasItem(u, x.g, x.s) : !1, wished: wish.includes(x.g + "|" + x.s) });
  return { on: !!c.shop.on, day, week: kstWeek(t), resetAt: nextKstMidnight(t), weekResetAt: weekly.length ? nextKstMonday(t) : 0, items: items.map(mark), weekly: weekly.map(mark), gold: u && "number" == typeof u.gold ? u.gold : null, wish };
};
// the wishlist: skins (gun|skin) the player wants; the shop marks them and the game says
// when one is on sale today. Thirty at most.
const WISH_MAX = 30;
const cleanWish = (u) => (Array.isArray(u.wish) ? u.wish.filter((x) => "string" == typeof x && /^[a-z]+\|[a-z_]+$/.test(x)).filter((x) => { const [g, s] = x.split("|"); return GUNS.includes(g) && SKIN_TIER[s] && !EXCLUSIVE[s] && fits(s, g); }).slice(0, WISH_MAX) : []);
A.wish = async (q, b) => {
  const u = await who(b.token);
  if (!u) throw fail(401, "다시 로그인해 주세요");
  let list = cleanWish(u);
  if (b.item) {
    if (await limited("wish:" + rlKey(u), 30, 10)) throw fail(429, "너무 빨리 눌렀습니다");
    const it = String(b.item),
      [g, s] = it.split("|");
    if (!GUNS.includes(g) || !Object.hasOwn(SKIN_TIER, s) || !fits(s, g)) throw fail(400, "없는 아이템입니다");
    if (EXCLUSIVE[s]) throw fail(400, "시즌 보상 스킨은 찜할 수 없습니다");
    const had = list.includes(it);
    if (!1 === b.on) list = list.filter((x) => x !== it);
    else if (!list.includes(it)) {
      if (list.length >= WISH_MAX) throw fail(409, `찜은 ${WISH_MAX}개까지입니다`);
      list.push(it);
    }
    u.wish = list;
    await saveUser(u);
    had !== list.includes(it) && (await ulog(u.id, "wish", (had ? "찜 해제: " : "찜: ") + it, { item: it, on: had ? 0 : 1 }));
  }
  return { wish: list, max: WISH_MAX };
};
A.shop_buy = async (q, b) => {
  const c = await loadConfig(),
    u = await who(b.token);
  if (!u) throw fail(401, "다시 로그인해 주세요");
  if (await limited("shop:" + rlKey(u), 20, 10)) throw fail(429, "너무 빨리 눌렀습니다");
  if (!c.shop.on) throw fail(403, "지금은 상점이 닫혀 있습니다");
  ensureWallet(u, c);
  const day = kstDay(now());
  if (b.day && b.day !== day) throw fail(409, "상점이 새로 바뀌었습니다. 다시 확인해 주세요");
  if (b.week && b.week !== kstWeek(now())) throw fail(409, "주간 특가가 새로 바뀌었습니다. 다시 확인해 주세요");
  // a weekly-deal skin is bought at its weekly price, from the weekly list
  const weekly = weeklyOf(c, kstWeek(now()));
  const it = (b.w ? weekly : shopOf(c, day).filter(x => !weekly.some(w => w.g === x.g && w.s === x.s))).find((x) => x.g === b.g && x.s === b.s);
  if (!it) throw fail(404, b.w ? "이번 주 특가에 없는 스킨입니다" : "오늘 상점에 없는 스킨입니다");
  if (hasItem(u, it.g, it.s)) throw fail(409, "이미 가진 스킨입니다");
  if (u.gold < it.price) throw fail(402, `골드가 부족합니다 (${it.price.toLocaleString()} 필요)`);
  u.gold -= it.price;
  (u.own[it.g] = u.own[it.g] || []).push(it.s);
  Array.isArray(u.wish) && (u.wish = u.wish.filter((x) => x !== it.g + "|" + it.s));
  u.bought = (u.bought || 0) + 1;
  u.spent = (u.spent || 0) + it.price;
  await saveUser(u);
  await log("shop", `${u.id} 구매${it.w ? "(주간 특가)" : ""}: ${it.g}/${it.s} (${SKIN_TIERS.label(it.r)}) ${it.price}골드`, { user: u.id });
  await ulog(u.id, "shop", `구매${it.w ? "(주간 특가)" : ""}: ${it.g}/${it.s} (${SKIN_TIERS.label(it.r)}) ${it.price}골드`, { g: it.g, s: it.s, r: it.r, price: it.price, w: it.w ? 1 : 0, dg: -it.price, gold: u.gold });
  return { item: it, gold: u.gold, owned: ownedCount(u), items: ITEMS, own: u.own, user: publicUser(u, c.xp.perLevel) };
};
// a pull of one or ten: gold out, items in, never one already owned. The
// collection and the gold are kept on the account, so a pull is only ever
// granted here.
A.gacha = async (q, b) => {
  const c = await loadConfig(),
    u = await who(b.token);
  if (!u) throw fail(401, "다시 로그인해 주세요");
  if (await limited("gacha:" + rlKey(u), 20, 10)) throw fail(429, "너무 빨리 뽑고 있습니다");
  ensureWallet(u, c);
  const n = 10 === (b.n | 0) ? 10 : 1,
    cost = Math.max(0, Math.round(10 === n ? c.gacha.cost10 : c.gacha.cost1)),
    left = TIER_KEYS.reduce((total, _, i) => total + poolOf(u, i + 1).length, 0);
  const collector = left === 0 && poolOf(u, 5, true).length > 0;
  if (left < n && !collector) throw fail(409, left > 0 ? `남은 스킨이 ${left}개뿐입니다` : "모든 뽑기 스킨을 모았습니다");
  if (u.gold < cost) throw fail(402, `골드가 부족합니다 (${cost} 필요)`);
  const results = [];
  for (let i = 0; i < n; i++) {
    const r = rollOne(u, c.gacha.odds);
    r && results.push(r);
  }
  // Once the ordinary collection is complete every requested pull still gets
  // the exact ultra roll. Empty pulls are refunded; never manufacture a win.
  const charged = collector ? Math.round(cost * results.length / n) : cost;
  u.gold -= charged;
  u.pulls = (u.pulls || 0) + n;
  await saveUser(u);
  const leg = results.filter((r) => r.r >= 4);
  leg.length && (await log("gacha", `${u.id} 전설·초월 스킨: ${leg.map((r) => r.g + "/" + r.s).join(", ")}`, { user: u.id }));
  await ulog(u.id, "gacha", `${n}회 뽑기 ${charged}골드${leg.length ? " · 전설 이상 " + leg.length : ""}`, { n, cost: charged, dg: -charged, res: results.map((r) => [r.g, r.s, r.r]), gold: u.gold, pulls: u.pulls });
  return { results, cost: charged, refunded: cost - charged, collector, gold: u.gold, owned: ownedCount(u), items: ITEMS, own: u.own, user: publicUser(u, c.xp.perLevel) };
};
// ── missions ──
// [id, period, what is counted, config key]; the targets and gold are in config.mission
const MIS = [
  ["d_play", "d", "play", "dPlay"],
  ["d_kill", "d", "kills", "dKill"],
  ["d_win", "d", "wins", "dWin"],
  ["w_play", "w", "play", "wPlay"],
  ["w_kill", "w", "kills", "wKill"],
  ["w_win", "w", "wins", "wWin"],
];
const KST = 9 * 36e5;
const kstDay = (t) => new Date(t + KST).toISOString().slice(0, 10);
// the Monday that starts this week, in Korea
const kstWeek = (t) => {
  const d = new Date(t + KST),
    back = (d.getUTCDay() + 6) % 7;
  return new Date(d.getTime() - back * 864e5).toISOString().slice(0, 10);
};
function misState(u, c) {
  const M = c.mission || {},
    t = now(),
    day = kstDay(t),
    week = kstWeek(t);
  isObj(u.mis) || (u.mis = { d: day, w: week, p: {}, got: {} });
  const m = u.mis;
  isObj(m.p) || (m.p = {});
  isObj(m.got) || (m.got = {});
  // a new day (or week) starts its missions from zero
  for (const [id, per] of MIS)
    if (("d" === per && m.d !== day) || ("w" === per && m.w !== week)) {
      delete m.p[id];
      delete m.got[id];
    }
  m.d = day;
  m.w = week;
  const list = [];
  for (const [id, per, stat, k] of MIS) {
    const n = Math.max(0, Math.round(+M[k] || 0));
    if (!n) continue;
    const have = Math.min(n, m.p[id] || 0);
    list.push({ id, per, stat, n, have, gold: Math.max(0, Math.round(+M[k + "Gold"] || 0)), done: have >= n, got: !!m.got[id] });
  }
  m.ready = list.filter((x) => x.done && !x.got).length;
  // when the day and the week end (ms since 1970)
  const dayEnd = Date.parse(day + "T00:00:00Z") - KST + 864e5,
    weekEnd = Date.parse(week + "T00:00:00Z") - KST + 7 * 864e5;
  return { list, ready: m.ready, dayEnd, weekEnd };
}
function misCount(u, c, add) {
  misState(u, c);
  for (const [id, , stat] of MIS) add[stat] > 0 && (u.mis.p[id] = (u.mis.p[id] || 0) + add[stat]);
  return misState(u, c);
}
A.missions = async (q, b) => {
  const c = await loadConfig(),
    u = await who(b.token);
  if (!u) throw fail(401, "다시 로그인해 주세요");
  const before = JSON.stringify(u.mis || null),
    st = misState(u, c);
  JSON.stringify(u.mis) !== before && (await saveUser(u));
  return { missions: st, user: publicUser(u, c.xp.perLevel) };
};
// gold for a finished mission (or every finished one: id "all"), once each
A.mission_claim = async (q, b) => {
  const c = await loadConfig(),
    u = await who(b.token);
  if (!u) throw fail(401, "다시 로그인해 주세요");
  if (await limited("mis:" + rlKey(u), 20, 10)) throw fail(429, "너무 빨리 눌렀습니다");
  ensureWallet(u, c);
  const st = misState(u, c),
    pick = st.list.filter((x) => x.done && !x.got && ("all" === b.id || x.id === b.id));
  if (!pick.length) throw fail(409, "받을 보상이 없습니다");
  let gold = 0;
  for (const x of pick) {
    u.mis.got[x.id] = 1;
    gold += x.gold;
  }
  u.gold += gold;
  await saveUser(u);
  await ulog(u.id, "mission", `미션 보상 ${pick.length}개 받음 +${gold}골드`, { ids: pick.map((x) => x.id), dg: gold, gold: u.gold });
  return { gold, ids: pick.map((x) => x.id), missions: misState(u, c), user: publicUser(u, c.xp.perLevel) };
};
// a match ticket: asked for when a match starts, handed back with the result.
// Signed here, good once, and only after the match has run for a while, so a
// result can't be sent without a real match behind it.
const MATCH_MIN_MS = 60 * 1000, // shortest match that earns kill/win rewards
  MATCH_MAX_MS = 3 * 3600 * 1000, // a ticket lasts this long
  KILL_EVERY_MS = 2500; // at most about one kill per 2.5 seconds of match
A.match_start = async (q, b) => {
  const u = await who(b.token);
  if (!u) throw fail(401, "다시 로그인해 주세요");
  // a ranked match: only from an account in the roster the host attested (ranked_start) for
  // this room. One ticket per account per match: asking again hands back the same one.
  let ranked = 0, m = "", n = crypto.randomBytes(12).toString("hex"), t0 = now(), fresh = !0;
  if (b.ranked) {
    if (u.guest) throw fail(403, "랭크전은 계정으로 로그인해야 합니다");
    const code = roomOf(b.room), rm = await getJ("room:" + code);
    if (!rm || !rm.ranked) throw fail(409, "랭크전 방이 아닙니다");
    m = (await redis(["GET", "rmroom:" + code])) || "";
    const rec = m && (await getJ("rm:" + m));
    if (!rec) throw fail(409, "랭크전이 아직 시작되지 않았습니다");
    if (!rec.a.includes(u.id) && !rec.b.includes(u.id)) throw fail(403, "이 랭크전의 참가자가 아닙니다");
    ranked = 1;
    t0 = rec.t0;
    const had = await redis(["GET", "rmt:" + m + ":" + u.id]);
    had && ((n = had), (fresh = !1));
  }
  // only a new ticket counts towards the limit: a refused ask (the client asks a few times before the
  // host has opened a ranked match) or the same ranked ticket asked again does not use it up
  if (fresh && (await limited("mstart:" + u.id, 12, 600))) throw fail(429, "너무 자주 보냈습니다");
  if (ranked && fresh && (await redis(["SET", "rmt:" + m + ":" + u.id, n, "NX", "EX", "14400"])) === null) ((n = await redis(["GET", "rmt:" + m + ":" + u.id])), (fresh = !1));
  fresh && (await redis(["SET", "mt:" + n, String(u.id), "EX", String(Math.ceil(MATCH_MAX_MS / 1000))]));
  return { ticket: sign(Object.assign({ k: "match", u: String(u.id), v: u.sessionVersion, n, t0, exp: t0 + MATCH_MAX_MS, r: ranked }, m ? { m } : {})), ranked: !!ranked };
};
// how much of a reported result to trust: kills and the win only with a valid,
// unused ticket from a long enough match; kills no faster than the clock allows
async function matchTrust(u, ticket) {
  const t = verify(ticket);
  if (!t || "match" !== t.k || String(t.u) !== String(u.id) || t.v !== u.sessionVersion || !t.n) return { ok: !1, why: "no_ticket" };
  const ms = now() - (+t.t0 || 0);
  if (ms < MATCH_MIN_MS) return { ok: !1, why: "too_short" };
  // Consumed with the wallet update and replayable receipt in one transaction.
  if (await redis(["GET", "mt:" + t.n]) !== String(u.id)) return { ok: !1, why: "used" };
  return { ok: !0, ranked: 1 === t.r, m: String(t.m || ""), key: "mt:" + t.n, receipt: "mr:" + t.n, maxKills: Math.floor(ms / KILL_EVERY_MS) + 1 };
}
// ── ranked match attestation ──
// RR and MMR are never taken from what a player reports about himself. The host of a ranked
// room opens the match with ranked_start (the roster per team; the server keeps each account's
// MMR as it was then) and gets a signed ticket. When the match is over the host sends the
// result with ranked_result (winning team, kills per account), once. Every player then settles
// his own match through `progress` with the ticket match_start gave him; RR/MMR come from the
// attested result and the team he was put in. The rule:
//  - humans = roster accounts that fetched their ticket (bots never count); fewer than
//    rank.minHumans, a draw, a match shorter than a minute: played, but no RR;
//  - a player's own `win`/`outcome` must equal the attested one, else the report is refused
//    (409) and counts as a dissent. The match is disputed, and nobody settled afterwards gets RR,
//    when a strict majority of the winning team's non-host players (those that took a ticket)
//    dissent, or when a strict majority of the losing team's do and no non-host winner confirms
//    the result: a loser saying he won is what a sore loser says too, so it only counts when
//    nobody but the host stands by the result;
//  - nobody is credited before every ticketed non-host player has voted, or RANKED_GRACE_MS
//    has passed since the host's result (progress answers 425 meanwhile, without using up its
//    rate limit); a report with giveUp settles with the votes cast so far;
//  - a team's strength (the Elo expectation) is the average MMR of its ticketed accounts only,
//    a team with none takes the other's;
//  - kills for the bonus are the host's count, lowered to the player's own if he reports fewer;
//  - an account settles a match once (its ticket is one per match, and the match id is kept
//    on the account); the daily RR cap still applies.
// Known limit: a host with accounts of his own can still lie about a match: one of them on his
// team standing by the result outweighs the other team saying it won.
const RESULT_TTL = 14400,
  // how long after the host's result a player's settlement waits for the others' votes (the client gives up at 120 s)
  RANKED_GRACE_MS = 60 * 1000;
// Reads a ranked match for one of its players and records his vote (first one stands). The
// ticketed humans are the accounts that took a ranked ticket: the roster alone proves nothing,
// the host may list accounts that never sat in the room.
async function rankedTally(u, m, b) {
  const [rec, res] = (await pipe([["GET", "rm:" + m], ["GET", "rmres:" + m]])).map((v) => (v ? JSON.parse(v) : null));
  const team = rec && (rec.a.includes(u.id) ? "a" : rec.b.includes(u.id) ? "b" : "");
  if (!rec || !team) return { rec: null };
  if (!res) return { rec, team, res: null };
  const outcome = res.w === "draw" ? "draw" : res.w === team ? "win" : "loss";
  const said = b.outcome === "draw" ? "draw" : b.win === undefined ? outcome : b.win ? "win" : "loss";
  const ids = rec.a.concat(rec.b), others = ids.filter((id) => id !== rec.host);
  const got = await pipe([["SET", "rmv:" + m + ":" + u.id, said === outcome ? "1" : "0", "NX", "EX", String(RESULT_TTL)]].concat(ids.map((id) => ["GET", "rmt:" + m + ":" + id]), others.map((id) => ["GET", "rmv:" + m + ":" + id])));
  const ticketed = new Set(ids.filter((id, i) => got[1 + i])), votes = new Map(others.map((id, i) => [id, got[1 + ids.length + i]]));
  // everybody who took a ticket and is not the host must have voted, or the grace has passed
  const pending = others.filter((id) => ticketed.has(id) && votes.get(id) == null);
  return { rec, res, team, outcome, said, ids, ticketed, votes, ready: !pending.length || now() - (+res.at || 0) >= RANKED_GRACE_MS };
}
async function rankedVerdict(u, trust, b) {
  const t = await rankedTally(u, trust.m, b), { rec, res, team } = t;
  if (!rec || !team) return { attested: !1, counted: !1, why: "no_match" };
  if (!res) {
    if (!b.giveUp) throw fail(425, "경기 결과를 기다리는 중입니다");
    return { attested: !1, counted: !1, why: "no_result" };
  }
  const { outcome, said, ticketed, votes } = t;
  if (said !== outcome) throw fail(409, "보고한 결과가 경기 기록과 다릅니다");
  // dissent: more than half of a team's ticketed non-host players said "0"; confirmed: one of them said "1"
  const voters = (list) => list.filter((id) => id !== rec.host && ticketed.has(id));
  const dissent = (list) => voters(list).filter((id) => votes.get(id) === "0").length * 2 > voters(list).length;
  const confirmed = (list) => voters(list).some((id) => votes.get(id) === "1");
  // a team's strength is the MMR (kept at ranked_start) of the accounts that really sat in the match
  const mean = (list) => {
    const mm = list.filter((id) => ticketed.has(id) && Object.hasOwn(rec.mmr || {}, id) && Number.isFinite(+rec.mmr[id])).map((id) => +rec.mmr[id]);
    return mm.length ? mm.reduce((s, v) => s + v, 0) / mm.length : null;
  };
  const avgA = mean(rec.a) ?? mean(rec.b) ?? rec.avgA, avgB = mean(rec.b) ?? mean(rec.a) ?? rec.avgB;
  const won = "b" === res.w ? rec.b : rec.a,
    lost = "b" === res.w ? rec.a : rec.b;
  const disputed = dissent(won) || (dissent(lost) && !confirmed(won));
  return {
    attested: !0,
    outcome,
    counted: outcome !== "draw" && !disputed,
    why: outcome === "draw" ? "draw" : disputed ? "disputed" : "",
    kills: Math.max(0, Math.min(60, +(res.k && res.k[u.id]) | 0)),
    humans: ticketed.size,
    mine: team === "a" ? avgA : avgB,
    enemy: team === "a" ? avgB : avgA,
    m: trust.m,
  };
}
A.ranked_start = async (q, b) => {
  const u = await who(b.token);
  if (!u) throw fail(401, "다시 로그인해 주세요");
  if (u.guest) throw fail(403, "랭크전은 계정으로 로그인해야 합니다");
  if (await limited("rstart:" + u.id, 12, 600)) throw fail(429, "너무 자주 보냈습니다");
  const code = roomOf(b.room), room = await getJ("room:" + code);
  if (!room || !room.ranked || room.host !== u.id) throw fail(409, "내가 연 랭크전 방이 아닙니다");
  const list = (v) => (Array.isArray(v) ? v : []).slice(0, 12).map((x) => String(x || "").toLowerCase()).filter((x) => ID_OK.test(x));
  const ta = list(b.a), tb = list(b.b), all = ta.concat(tb);
  if (new Set(all).size !== all.length) throw fail(400, "같은 계정이 두 번 들어 있습니다");
  // only accounts that exist, are not guests and are not banned stay in the roster
  const recs = (await pipe(all.map((id) => ["GET", userKey(id)]))).map((x) => (x ? JSON.parse(x) : null));
  const ok = new Map(recs.filter((x) => x && !x.guest && !(x.ban && (!x.ban.until || x.ban.until > now()))).map((x) => [x.id.toLowerCase(), x]));
  const side = (t) => t.filter((id) => ok.has(id)).map((id) => ok.get(id).id);
  const a = side(ta), bb = side(tb), mmr = Object.create(null);
  if (!a.concat(bb).includes(u.id)) throw fail(400, "방장이 참가자에 없습니다");
  const per = (await loadConfig()).xp.perLevel, lv = Object.create(null);
  for (const x of ok.values()) ((mmr[x.id] = mmrOf(x)), (lv[x.id] = lvInfo(x, per)));
  const avg = (t) => (t.length ? t.reduce((s, id) => s + mmr[id], 0) / t.length : null);
  // a team with no human takes the other's average (bots are the same strength)
  const avgA = avg(a) ?? avg(bb), avgB = avg(bb) ?? avg(a);
  const id = crypto.randomBytes(12).toString("hex"), t0 = now();
  const rec = { id, room: code, host: u.id, t0, a, b: bb, mmr, avgA, avgB, ownerPlayed: [...ok.values()].some((x) => x.owner && isOwnerId(x.id)) };
  await pipe([["SET", "rm:" + id, JSON.stringify(rec), "EX", String(RESULT_TTL)], ["SET", "rmroom:" + code, id, "EX", String(RESULT_TTL)]]);
  return { id, t0, lv, rm: sign({ k: "rmatch", m: id, u: u.id, room: code, t0, exp: t0 + MATCH_MAX_MS }), a, b: bb, ownerPlayed: rec.ownerPlayed };
};
// the host's result, once: w = "a" | "b" | "draw", k = kills per account
A.ranked_result = async (q, b) => {
  const u = await who(b.token);
  if (!u) throw fail(401, "다시 로그인해 주세요");
  const t = verify(b.rm);
  if (!t || "rmatch" !== t.k || t.u !== u.id) throw fail(409, "유효한 랭크전 확인표가 없습니다");
  const rec = await getJ("rm:" + t.m);
  if (!rec || rec.host !== u.id) throw fail(409, "없는 랭크전입니다");
  const ms = now() - rec.t0;
  if (ms < MATCH_MIN_MS) throw fail(409, "경기가 너무 짧습니다");
  if (!["a", "b", "draw"].includes(b.w)) throw fail(400, "결과가 이상합니다");
  const cap = Math.min(60, Math.floor(ms / KILL_EVERY_MS) + 1), k = Object.create(null);
  for (const id of rec.a.concat(rec.b)) isObj(b.k) && (k[id] = Math.max(0, Math.min(cap, b.k[id] | 0)));
  // the first result stands; a second one is ignored
  const first = (await redis(["SET", "rmres:" + t.m, JSON.stringify({ w: b.w, k, at: now() }), "NX", "EX", String(RESULT_TTL)])) !== null;
  return { accepted: first, duplicate: !first, w: first ? b.w : JSON.parse(await redis(["GET", "rmres:" + t.m])).w };
};
// may this account walk into that ranked room? Only the answer and the room's rounded band leave
A.ranked_can_join = async (q, b) => {
  const u = await who(b.token);
  if (!u) throw fail(401, "다시 로그인해 주세요");
  const room = await getJ("room:" + roomOf(b.code));
  if (!room) throw fail(404, "없는 방입니다");
  const r = canJoinRanked({ mmr: mmrOf(u), owner: !!u.owner }, room);
  return { ranked: !!room.ranked, ok: r.ok, range: r.range, band: room.ranked && Number.isFinite(room.mmr) ? bandOf(room.mmr) : null };
};
// What the room host may know about a player, to set the bots' skill and show a Lv chip: the account level, and the
// tier once placement is over. A guest, an unknown name and a malformed id all read the same (nulls), so this is not a
// way to find out who has an account. Never MMR, RR, email, tokens, IP or device.
const lvInfo = (x, per) => {
  if (!x || x.guest) return { level: null, t: null, tier: null, div: null, placed: false };
  const placed = placedOf(x) >= PLACE_N, r = rankOf(x.rr);
  return { level: levelOf(x.xp || 0, per).level, t: placed ? r.t : null, tier: placed ? r.tier : null, div: placed ? r.div : null, placed };
};
const LV_MAX = 12;
A.levels = async (q, b) => {
  if (await limited("lv:" + (requestState.getStore()?.get("requestIp") || "-"), 120, 60)) throw fail(429, "너무 자주 보냈습니다");
  const ids = [...new Set((Array.isArray(b.ids) ? b.ids : []).slice(0, LV_MAX).map((x) => String(x == null ? "" : x).trim()))].filter(Boolean);
  const valid = ids.filter((id) => ID_OK.test(id)), per = (await loadConfig()).xp.perLevel;
  const recs = valid.length ? (await pipe(valid.map((id) => ["GET", userKey(id)]))).map((x) => (x ? JSON.parse(x) : null)) : [];
  const users = Object.create(null);
  for (const id of ids) users[id] = lvInfo(null);
  valid.forEach((id, i) => (users[id] = lvInfo(recs[i], per)));
  return { users };
};
// the season's top accounts by RR: only placed accounts that played ranked this season
const LB_MAX = 100;
let lbCache = null;
A.leaderboard = async (q, b) => {
  const c = await loadConfig(), cur = seasonNow(c), n = Math.max(1, Math.min(LB_MAX, Math.round(+b.n) || 50));
  if (lbCache && lbCache.until > now() && lbCache.n === cur.n && lbCache.size >= n) return { ...lbCache.out, rows: lbCache.out.rows.slice(0, n) };
  const ids = (await redis(["ZRANGE", "lb:" + cur.n, "0", String(n * 2 - 1), "REV"])) || [];
  const rows = (await pipe(ids.map((id) => ["GET", userKey(id)])))
    .map((x) => (x ? JSON.parse(x) : null))
    .filter((x) => x && !x.guest && placedOf(x) >= PLACE_N && isObj(x.ssn) && x.ssn.n === cur.n && !(x.ban && (!x.ban.until || x.ban.until > now())))
    .map((x) => ({ name: x.id, rank: rankOf(x.rr), wins: x.ssn.w | 0, played: x.ssn.played | 0 }))
    .sort((p, r) => r.rank.rr - p.rank.rr || r.wins - p.wins || (p.name < r.name ? -1 : 1))
    .slice(0, n)
    .map((x, i) => ({ pos: i + 1, name: x.name, tier: x.rank.tier, t: x.rank.t, div: x.rank.div, rr: x.rank.rr, wins: x.wins, played: x.played }));
  const out = { season: { n: cur.n, end: cur.end }, rows };
  lbCache = { out, n: cur.n, size: n, until: now() + 10000 };
  return out;
};
A.progress = async (q, b) => {
  const c = await loadConfig(),
    u = await who(b.token);
  if (!u) throw fail(401, "다시 로그인해 주세요");
  const ticket = verify(b.mt);
  if (ticket && ticket.k === "match" && String(ticket.u) === String(u.id) && ticket.v === u.sessionVersion) {
    const receipt = await getJ("mr:" + ticket.n);
    if (receipt) {
      const user = publicUser(u, c.xp.perLevel), cap = Math.max(0, +c.gold.maxPerDay || 0);
      const used = u.goldDay && u.goldDay.d === kstDay(now()) ? u.goldDay.n || 0 : 0;
      if (cap > 0) user.goldLeft = Math.max(0, cap - used);
      return { ...receipt, user, goldLeft: cap > 0 ? user.goldLeft : null, hist: histOf(u), missions: misState(u, c), rank: rankView(u) };
    }
  }
  // a ranked match whose result the host has not sent yet: wait (425), without using up the rate limit
  // Then, once it is in, wait for the others' votes (the host's too must not settle before anyone could dispute):
  // record this player's vote first so the others can see it, then 425 until every ticketed player has voted or
  // the grace since the result has passed. A player whose own report disagrees is not made to wait (409 below).
  if (ticket && ticket.k === "match" && 1 === ticket.r && ticket.m && String(ticket.u) === String(u.id) && ticket.v === u.sessionVersion && !b.giveUp) {
    const t = await rankedTally(u, ticket.m, b);
    if (t.rec && t.team) {
      if (!t.res) throw fail(425, "경기 결과를 기다리는 중입니다");
      if (t.said === t.outcome && "draw" !== t.outcome && !t.ready) throw fail(425, "다른 플레이어의 결과 확인을 기다리는 중입니다");
    }
  }
  if (await limited("prog:" + u.id, 1, 20)) throw fail(429, "너무 자주 보냈습니다");
  // Every award requires a valid ticket; replay returns the committed receipt.
  const trust = await matchTrust(u, b.mt);
  if (!trust.ok) throw fail(409, trust.why === "too_short" ? "경기가 너무 짧아 보상을 받을 수 없습니다" : "유효한 경기 확인표가 없습니다");
  // ranked: the win/draw is the host's attested result for the team the server put him in
  // (a report that differs is refused); RR/MMR never read `humans` or `win` from the player
  const rkv = trust.ranked ? await rankedVerdict(u, trust, b) : null;
  const draw = rkv && rkv.attested ? rkv.outcome === "draw" : b.outcome === "draw" || (b.match && b.match.mode !== "dm" && Array.isArray(b.match.s) && b.match.s[0] === b.match.s[1]);
  const kills = trust.ok ? Math.max(0, Math.min(60, trust.maxKills, b.kills | 0)) : 0,
    win = trust.ok && !draw && (rkv && rkv.attested ? rkv.outcome === "win" : !!b.win);
  const before = levelOf(u.xp || 0, c.xp.perLevel).level;
  ensureWallet(u, c);
  // the day's ceilings, counted from midnight in Korea: gold, XP and Champion coins each have their own
  // counter ({d: day, n: used}); a match past a ceiling still counts (stats, missions) but gives none of it
  const day = new Date(now() + 9 * 36e5).toISOString().slice(0, 10),
    cap = Math.max(0, +c.gold.maxPerDay || 0),
    xcap = Math.max(0, +c.xp.maxPerDay || 0),
    ccap = Math.max(0, +c.gold.coinsPerDay || 0);
  (isObj(u.goldDay) && u.goldDay.d === day) || (u.goldDay = { d: day, n: 0 });
  (isObj(u.xpDay) && u.xpDay.d === day) || (u.xpDay = { d: day, n: 0 });
  (isObj(u.coinDay) && u.coinDay.d === day) || (u.coinDay = { d: day, n: 0 });
  const xleft = xcap > 0 ? Math.max(0, xcap - (u.xpDay.n || 0)) : Infinity;
  const gain = Math.max(0, Math.min(c.xp.maxPerReport, xleft, kills * c.xp.perKill + (win ? c.xp.perWin : 0) + c.xp.perMatch));
  const coinGain = ccap > 0 && (u.coinDay.n || 0) >= ccap ? 0 : 1;
  const left = cap > 0 ? Math.max(0, cap - (u.goldDay.n || 0)) : Infinity;
  const gold = Math.max(0, Math.min(c.gold.maxPerReport, left, (win ? c.gold.perWin : c.gold.perLoss) + kills * c.gold.perKill));
  u.gold += gold;
  u.championCoins += coinGain;
  u.coinDay.n = (u.coinDay.n || 0) + coinGain;
  u.goldDay.n = (u.goldDay.n || 0) + gold;
  // the rank: up with a win (more with kills), down a little with a loss
  const R = c.rank,
    kb = Math.max(0, Math.min(+R.maxKill || 0, kills * (+R.perKill || 0))),
    rr0 = Math.max(0, Math.round(+u.rr || 0)),
    rcap = Math.max(0, +R.maxPerDay || 0);
  (isObj(u.rrDay) && u.rrDay.d === day) || (u.rrDay = { d: day, n: 0 });
  // RR and MMR move only for a ranked match the host attested (see rankedVerdict), with at
  // least minHumans real accounts in it; a draw, a disputed match or a missing result moves nothing
  let drr = 0;
  const rb = rankView(u),
    humans = rkv ? rkv.humans : 0,
    dup = !!(rkv && Array.isArray(u.rmDone) && u.rmDone.includes(rkv.m)),
    rankedOk = !!(rkv && rkv.counted && !dup && humans >= Math.max(0, +R.minHumans || 0)),
    rankedWhy = rkv ? (dup ? "duplicate" : rkv.counted && !rankedOk ? "few_humans" : rkv.why || "") : "";
  const mmr0 = mmrOf(u);
  if (rankedOk) {
    u.rr = rr0;
    const placed0 = placedOf(u),
      placing = placed0 < PLACE_N,
      E = eloExpected(rkv.mine, rkv.enemy);
    u.mmr = mmrAfter(mmrOf(u), E, win ? 1 : 0, placing);
    if (placing) {
      // placement: the tier stays hidden; after the last match RR is set from MMR
      u.placed = placed0 + 1;
      u.placed >= PLACE_N && (u.rr = rrFromMMR(u.mmr));
    } else {
      drr = rrDelta(R, win, E, Math.min(kills, rkv.kills));
      drr > 0 && rcap > 0 && (drr = Math.min(drr, Math.max(0, rcap - (u.rrDay.n || 0))));
      u.rr = Math.max(0, rr0 + drr);
    }
    drr = u.rr - rr0;
    drr > 0 && !placing && (u.rrDay.n = (u.rrDay.n || 0) + drr);
    u.rmDone = [rkv.m].concat(Array.isArray(u.rmDone) ? u.rmDone : []).slice(0, 20);
    isObj(u.ssn) && ((u.ssn.played = (u.ssn.played | 0) + 1), win && (u.ssn.w = (u.ssn.w | 0) + 1));
  }
  u.xp = (u.xp || 0) + gain;
  u.xpDay.n = (u.xpDay.n || 0) + gain;
  const m = cleanMatch(b.match, win, kills);
  m && trust.ranked && (m.rk = 1);
  m && (u.hist = [Object.assign(m, { t: now(), xp: gain, gold, coinGain, rr: drr })].concat(histOf(u)).slice(0, HIST_MAX));
  u.kills = (u.kills || 0) + kills;
  u.wins = (u.wins || 0) + (win ? 1 : 0);
  u.matches = (u.matches || 0) + 1;
  const mis = misCount(u, c, { play: 1, kills, wins: win ? 1 : 0 });
  const p = publicUser(u, c.xp.perLevel);
  cap > 0 && (p.goldLeft = Math.max(0, cap - u.goldDay.n));
  const out = { trusted: trust.ok, ranked: !!trust.ranked, rankedCounted: rankedOk, rankedWhy, placement: p.placement, gain, gold, coinGain, goldLeft: cap > 0 ? p.goldLeft : null, rr: drr, rank: p.rank, rankBefore: rb, user: p, levelUp: p.level > before, hist: histOf(u), missions: mis };
  await saveUser(u, { ticketKey: trust.key, key: trust.receipt, value: out });
  // the season board: a placed account that counted a ranked match this season
  if (rankedOk && placedOf(u) >= PLACE_N && isObj(u.ssn)) {
    try { await pipe([["ZADD", "lb:" + u.ssn.n, String(u.rr), u.id.toLowerCase()], ["EXPIRE", "lb:" + u.ssn.n, String(120 * 86400)]]); } catch (e) {}
  }
  // the account's own log gets the hidden MMR too: it is read on the owner page only
  await ulog(u.id, "match", `${draw ? "무승부" : win ? "승리" : "패배"} · ${kills}킬${trust.ranked ? " · 랭크" + (rankedOk ? "" : " 미반영(" + (rankedWhy || "?") + ")") : ""}${m ? " · " + m.mode + " " + m.map : ""}`, { win: win ? 1 : 0, draw: draw ? 1 : 0, k: kills, xp: gain, dg: gold, gold: u.gold, rk: trust.ranked ? 1 : 0, ok: rankedOk ? 1 : 0, why: rankedWhy || undefined, rr: rankedOk ? [rr0, u.rr] : undefined, mmr: rankedOk ? [mmr0, u.mmr] : undefined, pl: rankedOk ? u.placed : undefined, lv: p.level });
  p.level > before && (await log("level", `${u.id} 레벨 ${p.level}`, { user: u.id }));
  p.rank.t !== rb.t && (await log("rank", `${u.id} ${rb.tier} ${rb.div} → ${p.rank.tier} ${p.rank.div}`, { user: u.id }));
  return out;
};
// relay servers for players whose networks cannot connect directly (Cloudflare
// TURN). The key stays here; players get credentials that expire in a day,
// and one set is shared for an hour so Cloudflare is asked rarely.
const TURN_ID = process.env.CF_TURN_KEY_ID || "",
  TURN_TOKEN = process.env.CF_TURN_API_TOKEN || "";
// or any TURN service with a fixed username and password (ExpressTURN, Metered,
// your own coturn): TURN_URLS lists the addresses, comma separated, e.g.
// "turn:relay.example.com:3478,turns:relay.example.com:443?transport=tcp".
// Used when the Cloudflare keys are missing or Cloudflare can't be reached.
const TURN_URLS = String(process.env.TURN_URLS || "")
    .split(/[\s,]+/)
    .filter((u) => /^turns?:/.test(u)),
  FIXED_ICE = TURN_URLS.length ? [{ urls: TURN_URLS, username: process.env.TURN_USERNAME || "", credential: process.env.TURN_CREDENTIAL || "" }] : [];
let iceCache = null;
A.ice = async () => {
  if (!TURN_ID || !TURN_TOKEN) return { iceServers: FIXED_ICE, relay: FIXED_ICE.length > 0 };
  if (iceCache && iceCache.until > now()) return { iceServers: iceCache.list, relay: !0 };
  const base = "https://rtc.live.cloudflare.com/v1/turn/keys/" + TURN_ID + "/credentials/";
  const hdr = { Authorization: "Bearer " + TURN_TOKEN, "Content-Type": "application/json" };
  let list = null;
  try {
    const r = await fetchTimed(base + "generate-ice-servers", { method: "POST", headers: hdr, body: JSON.stringify({ ttl: 86400 }) });
    if (r.ok) list = (await r.json()).iceServers;
  } catch (e) {}
  if (!list)
    try {
      const r = await fetchTimed(base + "generate", { method: "POST", headers: hdr, body: JSON.stringify({ ttl: 86400 }) });
      if (r.ok) {
        const j = await r.json();
        list = j.iceServers ? [].concat(j.iceServers) : null;
      }
    } catch (e) {}
  if (!list || !list.length) {
    await log("error", "TURN 접속표 발급 실패");
    return { iceServers: FIXED_ICE, relay: FIXED_ICE.length > 0 };
  }
  iceCache = { list, until: now() + 36e5 };
  return { iceServers: list, relay: !0 };
};
// the room list (rooms report themselves every few seconds while open)
const ROOM_TTL = 70;
const ROOM_NEW_MAX = 10;
let roomsCache = null;
A.rooms = async () => {
  const c = await loadConfig();
  if (!c.game.roomListOpen) return { rooms: [] };
  if (roomsCache && roomsCache.until > now()) return { rooms: roomsCache.rooms };
  await redis(["ZREMRANGEBYSCORE", "rooms", "-inf", String(now() - ROOM_TTL * 1000)]);
  // scored by the last heartbeat: the newest 200, not the 200 that went quiet first
  const codes = await redis(["ZRANGE", "rooms", "0", "199", "REV"]);
  const rows = await pipe(codes.map((k) => ["GET", "room:" + k]));
  const rooms = rows.filter(Boolean).map((r) => JSON.parse(r)).filter((r) => !r.private).map(({ code, name, ch, mode, map, players, max, state, host, created, ranked, mmr }) => ({ code, name, ch, mode, map, ranked: !!ranked, band: ranked && Number.isFinite(mmr) ? bandOf(mmr) : null, range: ranked ? joinRange(now() - created) : null, n: (players || []).length, max, state, host, created }));
  roomsCache = { rooms, until: now() + 5000 };
  return { rooms };
};
A.room_up = async (q, b, req) => {
  const c = await loadConfig(),
    u = await who(b.token);
  if (!u) throw fail(401, "다시 로그인해 주세요");
  const code = String(b.code || "").toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 6);
  if (6 !== code.length) throw fail(400, "방 코드가 이상합니다");
  const prev = await getJ("room:" + code);
  if (prev && prev.host !== u.id) throw fail(409, "다른 사람의 방입니다");
  // opening a new code writes a log line and a list entry; a room that is already open just beats its heart
  if (!prev && (await limited("roomnew:" + rlKey(u), ROOM_NEW_MAX, 600))) throw fail(429, "방을 너무 자주 열고 있습니다. 잠시 후 다시 시도해 주세요");
  const players = (Array.isArray(b.players) ? b.players : []).slice(0, 12).map((p) => String(p).slice(0, 20));
  const room = {
    code,
    name: String(b.name || u.id + "의 방").slice(0, 30),
    ch: String(b.ch || "s1").slice(0, 20),
    mode: String(b.mode || "").slice(0, 10),
    map: String(b.map || "").slice(0, 20),
    players,
    max: Math.min(c.game.maxRoomPlayers, Math.max(2, b.max | 0 || 10)),
    private: !!b.private,
    // a ranked room can only be opened by an account (never a guest) and is always public
    ranked: !!b.ranked && !u.guest,
    state: String(b.state || "lobby").slice(0, 10),
    host: u.id,
    ip: ipOf(req),
    created: (prev && prev.created) || now(),
    seen: now(),
    banAt: (prev && prev.banAt) || 0,
  };
  // a ranked room's average MMR (kept private; the list shows it rounded): measured when the
  // players change, and again every five minutes
  if (room.ranked) {
    const same = prev && prev.mmrAt && now() - prev.mmrAt < 300000 && JSON.stringify(prev.players) === JSON.stringify(players);
    if (same) ((room.mmr = prev.mmr), (room.mmrAt = prev.mmrAt));
    else {
      const ms = (await pipe(players.map((p) => ["GET", userKey(p)]))).map((x) => (x ? JSON.parse(x) : null)).filter((x) => x && !x.guest).map(mmrOf);
      ((room.mmr = ms.length ? ms.reduce((a, v) => a + v, 0) / ms.length : null), (room.mmrAt = now()));
    }
  }
  const fresh = players.filter((p) => !(prev && (prev.players || []).includes(p)));
  const checkAll = now() - room.banAt > 60000;
  checkAll && (room.banAt = now());
  const toCheck = checkAll ? players : fresh;
  await pipe([
    ["SET", "room:" + code, JSON.stringify(room), "EX", String(ROOM_TTL * 4)],
    ["ZADD", "rooms", String(now()), code],
  ]);
  prev || (await log("room", `방 열림 ${code} "${room.name}" (${u.id})`, { user: u.id, room: code }));
  // owner commands waiting for this room, and anyone banned who is in it
  const [cmds] = await pipe([
    ["LRANGE", "cmd:" + code, "0", "-1"],
    ["DEL", "cmd:" + code],
  ]);
  const banned = [];
  if (toCheck.length) {
    const recs = await pipe(toCheck.map((p) => ["GET", userKey(p)]));
    recs.forEach((r, i) => {
      if (!r) return;
      const x = JSON.parse(r);
      x.ban && (!x.ban.until || x.ban.until > now()) && banned.push(toCheck[i]);
    });
  }
  // the owner's room commands (kick, cheats, messages) do not run in a ranked room
  return { cmds: room.ranked ? [] : (cmds || []).map((x) => JSON.parse(x)), banned, config: { game: c.game, cheat: c.cheat, room: c.room }, band: room.ranked && Number.isFinite(room.mmr) ? bandOf(room.mmr) : null, range: room.ranked ? joinRange(now() - room.created) : null };
};
A.room_down = async (q, b) => {
  const u = await who(b.token);
  if (!u) throw fail(401, "다시 로그인해 주세요");
  const code = String(b.code || "").toUpperCase().slice(0, 6);
  const prev = await getJ("room:" + code);
  if (prev && prev.host === u.id) {
    await pipe([
      ["DEL", "room:" + code],
      ["ZREM", "rooms", code],
    ]);
    await log("room", `방 닫힘 ${code} (${u.id})`, { user: u.id, room: code });
  }
  return { ok: !0 };
};

// ── the owner ──
A.admin_login = async (q, b, req) => {
  const ip = ipOf(req);
  if (!MASTER) throw fail(503, "관리자 비밀번호가 서버에 설정되지 않았습니다");
  if (await limited("adm:" + ip, 8, 900)) throw fail(429, "너무 많이 시도했습니다. 15분 뒤에 다시");
  const a = crypto.createHash("sha256").update(String(b.pw || "")).digest(),
    m = crypto.createHash("sha256").update(MASTER).digest();
  if (!crypto.timingSafeEqual(a, m)) {
    await log("admin", "관리자 로그인 실패", { ip });
    throw fail(401, "비밀번호가 틀렸습니다");
  }
  await redis(["DEL", "rl:adm:" + ip]); // only wrong guesses count against the owner's sign-in
  await log("admin", "관리자 로그인", { ip });
  return { token: sign({ k: "admin", pv: 2, exp: now() + 12 * 36e5 }) };
};
const ADMIN = {};
ADMIN.stats = async () => {
  await redis(["ZREMRANGEBYSCORE", "rooms", "-inf", String(now() - ROOM_TTL * 1000)]);
  const [users, rooms, logs, devBans, ipBans] = await pipe([["ZCARD", "users"], ["ZCARD", "rooms"], ["LLEN", "logs"], ["KEYS", "ban:dev:*"], ["KEYS", "ban:ip:*"]]);
  const day = now() - 864e5;
  const recent = await redis(["ZCOUNT", "users", String(day), "+inf"]);
  await flushUse(!0);
  const usage = +(await redis(["GET", "usage:" + month()])) || 0;
  return { users, rooms, logs, newToday: recent, bans: (devBans || []).length + (ipBans || []).length, usage, usageLimit: 500000, month: month() };
};
// the dashboard's summary: the accounts (read in one go, newest 2000), the rooms, the
// last day of the log and the switches that matter most
ADMIN.summary = async () => {
  const c = await loadConfig(),
    t = now(),
    day = t - 864e5,
    week = t - 7 * 864e5;
  const ids = ((await redis(["ZRANGE", "users", "0", "-1", "REV"])) || []).slice(0, 2000);
  const recs = ids.length ? (await redis(["MGET", ...ids.map((k) => "user:" + k)])) || [] : [];
  const S = { users: ids.length, scanned: 0, bought: 0, spent: 0, new1: 0, new7: 0, act1: 0, act7: 0, gold: 0, pulls: 0, owned: 0, matches: 0, kills: 0, wins: 0, admins: 0, perms: 0, aimPc: 0, aimMobileOff: 0, banned: 0, ranked: 0, ranks: Array(RANKS.length).fill(0), signups: Array(14).fill(0) };
  const top = [],
    cur = seasonNow(c, t);
  S.season = Object.assign({}, cur, { players: 0 });
  const d0 = new Date(t);
  d0.setHours(0, 0, 0, 0);
  for (const r of recs) {
    if (!r) continue;
    let u;
    try {
      u = JSON.parse(r);
    } catch (e) {
      continue;
    }
    S.scanned++;
    u.created > day && S.new1++;
    u.created > week && S.new7++;
    u.lastSeen > day && S.act1++;
    u.lastSeen > week && S.act7++;
    S.gold += "number" == typeof u.gold ? u.gold : 0;
    S.pulls += u.pulls || 0;
    S.bought += u.bought || 0;
    S.cosBought = (S.cosBought || 0) + (u.cosBought || 0);
    S.spent += u.spent || 0;
    S.owned += ownedCount(u);
    S.matches += u.matches || 0;
    S.kills += u.kills || 0;
    S.wins += u.wins || 0;
    (u.owner || (u.adminUntil && u.adminUntil > t)) && S.admins++;
    activePerm(u) && S.perms++;
    const a = aimOf(u);
    a.pc && S.aimPc++;
    a.mobile || S.aimMobileOff++;
    u.ban && (!u.ban.until || u.ban.until > t) && S.banned++;
    const rk = rankOf(seasonRR(u, c, cur));
    isObj(u.ssn) && u.ssn.n === cur.n && (u.ssn.played | 0) > 0 && S.season.players++;
    S.ranks[rk.t]++;
    (u.rr || 0) > 0 && S.ranked++;
    const ago = Math.floor((d0.getTime() + 864e5 - 1 - (u.created || 0)) / 864e5);
    ago >= 0 && ago < 14 && S.signups[13 - ago]++;
    top.push({ id: u.id, rr: rk.rr, rank: rk, kills: u.kills || 0, wins: u.wins || 0, matches: u.matches || 0, level: levelOf(u.xp || 0, c.xp.perLevel).level });
  }
  S.topRR = top.slice().sort((a, b) => b.rr - a.rr).slice(0, 5);
  S.topKills = top.slice().sort((a, b) => b.kills - a.kills).slice(0, 5);
  // the last day of the log, by kind, and the owner's latest operations
  const L = { login: 0, join: 0, guest: 0, auth: 0, room: 0, gacha: 0, shop: 0 },
    recent = [];
  for (const x of (await redis(["LRANGE", "logs", "0", "999"])) || []) {
    let e;
    try {
      e = JSON.parse(x);
    } catch (err) {
      continue;
    }
    e.t > day && e.type in L && L[e.type]++;
    ("admin" === e.type || "gacha" === e.type || "shop" === e.type) && recent.length < 10 && recent.push({ t: e.t, type: e.type, msg: e.msg });
  }
  await redis(["ZREMRANGEBYSCORE", "rooms", "-inf", String(t - ROOM_TTL * 1000)]);
  const codes = (await redis(["ZRANGE", "rooms", "0", "-1"])) || [];
  const rows = (codes.length ? await pipe(codes.map((k) => ["GET", "room:" + k])) : []).filter(Boolean).map((r) => JSON.parse(r));
  const R = { open: rows.length, people: 0, ranked: 0, playing: 0, modes: {} };
  for (const r of rows) {
    R.people += (r.players || []).length;
    r.ranked && R.ranked++;
    "lobby" !== r.state && R.playing++;
    R.modes[r.mode || "?"] = (R.modes[r.mode || "?"] || 0) + 1;
  }
  return { summary: S, logs: L, recent, rooms: R, items: ITEMS, config: { game: c.game, cheat: { enabled: c.cheat.enabled }, aim: c.aim, gacha: c.gacha, gold: c.gold, rank: c.rank, shop: c.shop, season: c.season }, shop: c.shop.on ? shopOf(c, kstDay(t)) : [], shopReset: nextKstMidnight(t), weekly: c.shop.on ? weeklyOf(c, kstWeek(t)) : [], weeklyReset: nextKstMonday(t), t };
};
ADMIN.users = async (q, b) => {
  const c = await loadConfig();
  const all = await redis(["ZRANGE", "users", "0", "-1", "REV"]);
  const qs = String(b.q || "").toLowerCase();
  const ids = all.filter((x) => !qs || x.includes(qs));
  const page = ids.slice((b.page | 0) * 50, (b.page | 0) * 50 + 50);
  const recs = await pipe(page.map((k) => ["GET", "user:" + k]));
  return {
    total: ids.length,
    users: recs.filter(Boolean).map((r) => {
      const u = JSON.parse(r);
      return Object.assign(publicUser(u, c.xp.perLevel), { lastSeen: u.lastSeen, lastIp: u.lastIp, dev: u.dev, ban: u.ban || null, note: u.note || "", permSet: u.perm || null });
    }),
  };
};
// An account the owner makes an admin gets every cheat too (the invincibility among them), for as long as it is an admin;
// when the admin mode is taken away, the account's own cheats from before come back (permBefore).
function adminCheats(u) {
  const t = now();
  if (u.adminUntil && u.adminUntil > t) {
    const cur = u.perm && u.perm.on && !(u.perm.until && u.perm.until < t) ? u.perm : null,
      full = Object.assign({ on: !0, speed: 3, fastFire: 10, buff: Math.max(10, (cur && cur.buff) || 0) }, Object.fromEntries(PERM_SW.map((k) => [k, !0])));
    const out = cleanPerm(full, 0);
    // whatever the account already had keeps its own end if that is later (or none)
    out.until = cur && (!cur.until || cur.until > u.adminUntil) ? cur.until : u.adminUntil;
    if (!u.permAdmin) u.permBefore = cur || null;
    u.perm = out;
    u.permAdmin = !0;
  } else if (u.permAdmin) {
    u.perm = u.permBefore || Object.assign({}, u.perm || {}, { on: !1 });
    delete u.permAdmin;
    delete u.permBefore;
  }
}
// the owner's changes to an account, as its own log shows them
const OP_KO = { ban: "차단", unban: "차단 해제", admin: "관리자 모드", xp: "경험치 설정", level: "레벨 설정", password: "비밀번호 변경", note: "메모", perm: "치트 권한", aim: "에임 보정", gold: "골드 설정", rr: "티어 점수 설정", grant: "스킨 지급" };
const opNote = (b, u, was) => ("ban" === b.op ? (b.days > 0 ? ` ${b.days}일` : " 영구") + (b.reason ? ` (${String(b.reason).slice(0, 60)})` : "") : "gold" === b.op ? ` ${was.gold ?? 0} → ${u.gold}` : "rr" === b.op ? ` ${was.rr || 0} → ${u.rr}` : "grant" === b.op ? (b.remove ? " 회수 " : " ") + (Array.isArray(b.items) ? b.items.length + "개" : b.item === "all" ? "전부" : String(b.item || "").slice(0, 40)) : "level" === b.op || "xp" === b.op ? ` ${was.xp || 0} → ${u.xp} xp` : "");
ADMIN.user_set = async (q, b) => {
  const id = cleanId(b.id),
    u = await getJ(userKey(id));
  if (!u) throw fail(404, "없는 아이디");
  const c = await loadConfig(),
    d = b.days > 0 ? now() + b.days * 864e5 : 0,
    was = { gold: u.gold, rr: u.rr, xp: u.xp };
  switch (b.op) {
    case "ban":
      u.ban = { reason: String(b.reason || "").slice(0, 200), until: d, at: now() };
      break;
    case "unban":
      delete u.ban;
      break;
    case "admin":
      // with an item list (the owner page's editor) the period is set from now; without one it is extended as before
      if (isObj(b.allow)) {
        u.adminUntil = b.days > 0 ? now() + b.days * 864e5 : 0;
        u.adminAllow = cleanAllow(b.allow);
      } else u.adminUntil = b.days > 0 ? Math.max(now(), u.adminUntil || 0) + b.days * 864e5 : 0;
      adminCheats(u);
      break;
    case "xp":
      u.xp = Math.max(0, Math.min(XP_MAX, Math.round(+b.xp || 0)));
      break;
    case "level": {
      // the xp that starts level L is perLevel * (1 + 2 + ... + (L - 1)); a typo like 99999999 must not loop that long
      const lv = Math.max(1, Math.min(1e6, Math.floor(+b.level || 1)));
      u.xp = Math.min(XP_MAX, (c.xp.perLevel * lv * (lv - 1)) / 2);
      break;
    }
    case "password":
      if (String(b.pw || "").length < 4 || String(b.pw || "").length > 64) throw fail(400, "비밀번호는 4~64자");
      u.pass = hashPw(b.pw);
      u.sessionVersion = crypto.randomBytes(16).toString("hex");
      break;
    case "note":
      u.note = String(b.note || "").slice(0, 300);
      break;
    case "perm":
      // what the owner page edits are the account's own cheats, also while admin mode lends it the full set
      setOwnPerm(u, cleanPerm(b.perm, +b.days || 0));
      break;
    case "aim":
      u.aim = { pc: !!b.pc, mobile: !1 !== b.mobile, until: b.pc && b.days > 0 ? d : 0 };
      break;
    case "gold":
      ensureWallet(u, c);
      u.gold = Math.max(0, Math.min(9e6, Math.round(+b.gold || 0)));
      break;
    case "rr":
      u.rr = Math.max(0, Math.min(99999, Math.round(+b.rr || 0)));
      u.mmr = mmrFromRR(u.rr); // the hidden rating follows; RR given by hand counts as placed
      u.rr > 0 && (u.placed = PLACE_N);
      break;
    case "grant": {
      // item "gun|skin" or "all", or items: a list of "gun|skin" (the owner page's table); remove takes them back
      ensureWallet(u, c);
      const list = Array.isArray(b.items) ? b.items.slice(0, ITEMS) : null,
        all = !list && "all" === b.item,
        pairs = list ? list.map((x) => String(x || "").split("|")) : all ? [] : [String(b.item || "").split("|")];
      for (const [g, s] of pairs) if (!GUNS.includes(g) || !Object.hasOwn(SKIN_TIER, s) || !fits(s, g)) throw fail(400, "없는 아이템 (총|스킨): " + String(g).slice(0, 20) + "|" + String(s).slice(0, 20));
      if (b.remove) {
        if (all) u.own = {};
        else for (const [g, s] of pairs) u.own[g] = (u.own[g] || []).filter((x) => x !== s);
      } else if (all) for (const gg of GUNS) u.own[gg] = SKIN_IDS.filter((x) => fits(x, gg));
      else for (const [g, s] of pairs) hasItem(u, g, s) || (u.own[g] = u.own[g] || []).push(s);
      trimPicks(u);
      break;
    }
    case "delete":
      await pipe([
        ["DEL", userKey(id)],
        ["ZREM", "users", id.toLowerCase()],
      ]);
      await log("admin", "계정 삭제: " + id);
      await ulog(id, "admin", "운영자: 계정 삭제", { op: "delete" });
      return { ok: !0 };
    default:
      throw fail(400, "알 수 없는 작업");
  }
  await saveUser(u);
  await ulog(u.id, "admin", "운영자: " + (OP_KO[b.op] || b.op) + opNote(b, u, was), { op: b.op, days: b.days > 0 ? +b.days : undefined, why: "ban" === b.op ? String(b.reason || "").slice(0, 80) : undefined, gold: "gold" === b.op ? [was.gold, u.gold] : undefined, rr: "rr" === b.op ? [was.rr || 0, u.rr] : undefined, xp: "xp" === b.op || "level" === b.op ? [was.xp || 0, u.xp] : undefined, n: "grant" === b.op ? (Array.isArray(b.items) ? b.items.length : "all" === b.item ? "all" : 1) : undefined, rm: "grant" === b.op && b.remove ? 1 : undefined, perm: "perm" === b.op ? { on: ownPerm(u).on ? 1 : 0, sw: PERM_SW.filter((k) => ownPerm(u)[k]).join(","), sp: ownPerm(u).speed, ff: ownPerm(u).fastFire, bf: ownPerm(u).buff, until: ownPerm(u).until } : undefined, until: "admin" === b.op ? u.adminUntil || 0 : undefined });
  await log("admin", `계정 ${id}: ${b.op}${b.days ? " " + b.days + "일" : ""}${b.reason ? " (" + b.reason + ")" : ""}${"gold" === b.op ? " " + u.gold : ""}${"rr" === b.op ? " " + u.rr : ""}${"grant" === b.op ? " " + (Array.isArray(b.items) ? b.items.length + "개" : b.item) + (b.remove ? " 회수" : "") : ""}${"aim" === b.op ? ` PC ${b.pc ? "켬" : "끔"} · 모바일 ${!1 !== b.mobile ? "켬" : "끔"}` : ""}`);
  return { ok: !0 };
};
// one account's skins, for the owner page's grant table
ADMIN.user_skins = async (q, b) => {
  const u = await getJ(userKey(cleanId(b.id)));
  if (!u) throw fail(404, "없는 아이디");
  const own = {};
  if (isObj(u.own)) for (const g of GUNS) Array.isArray(u.own[g]) && (own[g] = u.own[g].filter((s) => SKIN_TIER[s] && fits(s, g)));
  return { id: u.id, own, owned: ownedCount({ own }), items: ITEMS, gold: "number" == typeof u.gold ? u.gold : null, guns: GUNS, tiers: SKIN_TIER, only: SKIN_ONLY };
};
// one account's whole profile for the owner page, in one call: the account (nothing secret: no hash, no
// session), its own activity log, totals counted from that log, and, for the time before the log began, what
// can still be found (server-log lines that name it, the last matches kept on the account, the sign-up).
// A guest is found through its name (gname:) to its device's record.
ADMIN.user_profile = async (q, b) => {
  const id = cleanId(b.id).slice(0, 40),
    lc = id.toLowerCase();
  if (!id) throw fail(400, "아이디가 없습니다");
  const c = await loadConfig(),
    t = now();
  let u = await getJ(userKey(id));
  if (!u) {
    const dev = await redis(["GET", guestNameKey(id)]);
    u = dev ? await getJ(guestKey(dev)) : null;
  }
  const me = u && u.guest ? "g:" + u.dev : "u:" + lc;
  const [lines, global, ordIds, fbIds] = await pipe([["LRANGE", ulogKey(id), "0", String(ULOG_MAX - 1)], ["LRANGE", "logs", "0", "1999"], ["LRANGE", "ordu:u:" + lc, "0", "19"], ["LRANGE", "fbu:" + me, "0", "19"]]);
  const parse = (x) => {
    try { return JSON.parse(x); } catch (e) { return null; }
  };
  const own = (lines || []).map(parse).filter((e) => e && e.t && e.k);
  if (!u && !own.length) throw fail(404, "없는 아이디");
  const recs = ((ordIds || []).length || (fbIds || []).length ? await pipe((ordIds || []).map((i) => ["GET", "ord:" + i]).concat((fbIds || []).map((i) => ["GET", "fb:" + i]))) : []).map((x) => (x ? parse(x) : null));
  const orders = recs.slice(0, (ordIds || []).length).filter(Boolean).map((o) => ({ id: o.id, t: o.t, items: o.items, days: o.days, total: o.total, status: o.status, until: o.until || 0, reason: o.reason || "" }));
  const feedback = recs.slice((ordIds || []).length).filter(Boolean).map((f) => ({ id: f.id, t: f.t, type: f.type, title: f.title, status: f.status }));
  // the log begins at its oldest line; before that only what the server log and the account itself kept
  const since = own.length ? own[own.length - 1].t : 0,
    before = (x) => !since || x < since;
  const timeline = own.map((e) => Object.assign({ s: "u" }, e));
  const mine = (e) => (e.user && String(e.user).toLowerCase() === lc) || (("auth" === e.type || "admin" === e.type) && (String(e.msg).toLowerCase().endsWith(": " + lc) || String(e.msg).toLowerCase().startsWith("계정 " + lc + ":")));
  for (const x of global || []) {
    const e = parse(x);
    e && e.t && before(e.t) && mine(e) && timeline.push({ s: "g", t: e.t, k: "auth" === e.type ? "loginfail" : String(e.type).slice(0, 12), m: String(e.msg || "").slice(0, 140), d: e.ip ? { ip: e.ip } : undefined });
  }
  if (u) {
    for (const h of histOf(u)) h && h.t && before(h.t) && timeline.push({ s: "h", t: h.t, k: "match", m: `${h.win ? "승리" : "패배"} · ${h.k || 0}킬${h.rk ? " · 랭크" : ""} · ${h.mode || ""} ${h.map || ""}`.trim(), d: { win: h.win ? 1 : 0, k: h.k || 0, xp: h.xp, dg: h.gold, rr: h.rr || undefined, rk: h.rk ? 1 : 0 } });
    u.created && before(u.created) && !timeline.some((e) => "join" === e.k && e.t <= u.created + 5000) && timeline.push({ s: "h", t: u.created, k: "join", m: u.guest ? "게스트 첫 입장" : "계정 생성" });
  }
  timeline.sort((p, r) => r.t - p.t);
  // totals from the log's own lines
  const agg = { logins: 0, fails: 0, gacha: { times: 0, pulls: 0, cost: 0, byRarity: {} }, gold: { earned: 0, spent: 0 }, shop: 0, matches: 0, wins: 0, ips: [], devs: [] };
  const seen = (list, v, e) => {
    if (!v) return;
    const f = list.find((x) => x.v === v);
    f ? (f.n++, f.t = Math.max(f.t, e.t)) : list.push({ v, n: 1, t: e.t });
  };
  for (const e of own) {
    const d = e.d || {};
    if ("login" === e.k || "join" === e.k || "guest" === e.k) (agg.logins++, seen(agg.ips, d.ip, e), seen(agg.devs, d.dev, e));
    else if ("loginfail" === e.k) agg.fails++;
    if ("gacha" === e.k) {
      agg.gacha.times++;
      agg.gacha.pulls += d.n | 0;
      agg.gacha.cost += d.cost | 0;
      for (const r of Array.isArray(d.res) ? d.res : []) agg.gacha.byRarity[r[2]] = (agg.gacha.byRarity[r[2]] || 0) + 1;
    }
    ("shop" === e.k || "cos" === e.k) && (d.price || d.coins) && agg.shop++;
    if ("match" === e.k) (agg.matches++, d.win && agg.wins++);
    typeof d.dg === "number" && (d.dg > 0 ? (agg.gold.earned += d.dg) : (agg.gold.spent -= d.dg));
  }
  const last = (list) => list.sort((p, r) => r.t - p.t).slice(0, 10);
  agg.ips = last(agg.ips);
  agg.devs = last(agg.devs);
  const out = { id: u ? u.id : id, found: !!u, log: timeline.slice(0, 900), since, capped: own.length >= ULOG_MAX, agg, orders, itemNames: Object.fromEntries(ORDER_ITEMS.map((x) => [x.k, x.name])), feedback, t };
  if (!u) return { profile: out };
  const lv = levelOf(u.xp || 0, c.xp.perLevel),
    cur = seasonNow(c, t),
    tiers = {},
    guns = {};
  if (isObj(u.own)) for (const g in u.own) if (Array.isArray(u.own[g])) for (const s of u.own[g]) SKIN_TIER[s] && (tiers[SKIN_TIER[s]] = (tiers[SKIN_TIER[s]] || 0) + 1, guns[g] = (guns[g] || 0) + 1);
  const ban = u.ban ? Object.assign({ active: !u.ban.until || u.ban.until > t }, u.ban) : null;
  const acct = {
    id: u.id, guest: !!u.guest, created: u.created || 0, lastSeen: u.lastSeen || 0, lastIp: u.lastIp || "", dev: u.dev || "",
    level: lv.level, xp: u.xp || 0, into: lv.into, need: lv.need, gold: "number" == typeof u.gold ? u.gold : 0, championCoins: Number.isSafeInteger(u.championCoins) ? u.championCoins : 0,
    pulls: u.pulls || 0, bought: u.bought || 0, cosBought: u.cosBought || 0, spent: u.spent || 0, refunded: u.refunded || 0,
    kills: u.kills || 0, wins: u.wins || 0, matches: u.matches || 0,
    owner: !!u.owner, admin: !!(u.owner || (u.adminUntil && u.adminUntil > t)), adminUntil: u.adminUntil || 0, adminAllow: isObj(u.adminAllow) ? u.adminAllow : null,
    permActive: !!activePerm(u), perm: u.perm || null, aim: aimOf(u), ban, note: u.note || "",
    // the hidden rating is for the owner page only
    rank: { rr: Math.max(0, Math.round(+u.rr || 0)), now: rankOf(seasonRR(u, c, cur)), shown: rankView(u), placed: u.guest ? 0 : placedOf(u), of: PLACE_N, mmr: u.guest ? null : mmrOf(u) },
    season: isObj(u.ssn) ? { n: u.ssn.n, end: u.ssn.end, played: u.ssn.played | 0, wins: u.ssn.w | 0, need: u.ssn.need | 0, cur: cur.n } : null,
    seasonLog: Array.isArray(u.ssnLog) ? u.ssnLog.slice(0, 12) : [],
    owned: { total: ownedCount(u), items: ITEMS, byTier: tiers, byGun: guns },
    equipped: (u.skins && isObj(u.skins.m) && u.skins.m) || {},
    wish: cleanWish(u), missions: misState(u, c), cos: cosOf(u),
    goldDay: isObj(u.goldDay) ? u.goldDay : null, xpDay: isObj(u.xpDay) ? u.xpDay : null, coinDay: isObj(u.coinDay) ? u.coinDay : null, rrDay: isObj(u.rrDay) ? u.rrDay : null,
    hist: histOf(u),
  };
  return { profile: Object.assign(out, { acct }) };
};
ADMIN.bans = async () => {
  const keys = [...((await redis(["KEYS", "ban:dev:*"])) || []), ...((await redis(["KEYS", "ban:ip:*"])) || [])];
  const vals = await pipe(keys.map((k) => ["GET", k]));
  const all = await redis(["ZRANGE", "users", "0", "-1"]);
  const recs = await pipe(all.map((k) => ["GET", "user:" + k]));
  const users = recs.filter(Boolean).map((r) => JSON.parse(r)).filter((u) => u.ban && (!u.ban.until || u.ban.until > now())).map((u) => ({ kind: "user", key: u.id, ...u.ban }));
  return { bans: users.concat(keys.map((k, i) => Object.assign({ kind: k.split(":")[1], key: k.split(":").slice(2).join(":") }, JSON.parse(vals[i] || "{}")))) };
};
ADMIN.ban_set = async (q, b) => {
  const kind = "ip" === b.kind ? "ip" : "dev",
    key = String(b.key || "").slice(0, 64);
  if (!key) throw fail(400, "대상이 없습니다");
  if (b.remove) await redis(["DEL", `ban:${kind}:${key}`]);
  else await setJ(`ban:${kind}:${key}`, { reason: String(b.reason || "").slice(0, 200), until: b.days > 0 ? now() + b.days * 864e5 : 0, at: now() });
  await log("admin", `${b.remove ? "차단 해제" : "차단"} ${kind} ${key}`);
  return { ok: !0 };
};
ADMIN.rooms = async () => {
  await redis(["ZREMRANGEBYSCORE", "rooms", "-inf", String(now() - ROOM_TTL * 1000)]);
  const codes = await redis(["ZRANGE", "rooms", "0", "-1"]);
  const rows = await pipe(codes.map((k) => ["GET", "room:" + k]));
  return { rooms: rows.filter(Boolean).map((r) => JSON.parse(r)) };
};
ADMIN.room_cmd = async (q, b) => {
  const code = String(b.code || "").toUpperCase().slice(0, 6);
  const ok = ["kick", "move", "msg", "close", "settings", "cheat", "hp", "kill", "god", "bind"];
  if (!ok.includes(b.cmd)) throw fail(400, "알 수 없는 명령");
  const cmd = { cmd: b.cmd, name: b.name ? String(b.name).slice(0, 20) : undefined, team: b.team, text: b.text ? String(b.text).slice(0, 200) : undefined, set: isObj(b.set) ? b.set : undefined, v: null != b.v && isFinite(+b.v) ? +b.v : undefined, at: now() };
  await pipe([
    ["RPUSH", "cmd:" + code, JSON.stringify(cmd)],
    ["EXPIRE", "cmd:" + code, "300"],
  ]);
  await log("admin", `방 ${code} 명령: ${b.cmd}${b.name ? " " + b.name : ""}${b.text ? " " + b.text : ""}`, { room: code });
  return { ok: !0 };
};
ADMIN.logs = async (q, b) => {
  const rows = (await redis(["LRANGE", "logs", "0", String(Math.min(4999, (b.limit | 0) || 500))])).map((x) => JSON.parse(x));
  const t = String(b.type || ""),
    s = String(b.q || "").toLowerCase();
  return { logs: rows.filter((r) => (!t || r.type === t) && (!s || JSON.stringify(r).toLowerCase().includes(s))) };
};
ADMIN.logs_clear = async () => {
  await redis(["DEL", "logs"]);
  await log("admin", "로그 비움");
  return { ok: !0 };
};

// the feedback box
ADMIN.feedback = async (q, b) => {
  const ids = await redis(["LRANGE", "fb", "0", "2999"]);
  const rows = ids.length ? (await pipe(ids.map((i) => ["GET", "fb:" + i]))).filter(Boolean).map((x) => JSON.parse(x)) : [];
  const t = String(b.type || ""),
    st = String(b.status || ""),
    s = String(b.q || "").toLowerCase();
  const counts = { total: rows.length, new: 0, ice: 0, byType: {} };
  const hasIce = (r) => !!(r.ctx && r.ctx.ice && r.ctx.ice.lines && r.ctx.ice.lines.length);
  for (const r of rows) {
    "new" === r.status && counts.new++;
    hasIce(r) && counts.ice++;
    counts.byType[r.type] = (counts.byType[r.type] || 0) + 1;
  }
  const items = rows.filter((r) => (!t || r.type === t) && (!st || r.status === st) && (!b.ice || hasIce(r)) && (!s || JSON.stringify(r).toLowerCase().includes(s))).slice(0, Math.max(1, Math.min(500, (b.limit | 0) || 200)));
  return { items, counts, types: FB_TYPES };
};
ADMIN.feedback_set = async (q, b) => {
  const id = String(b.id || "").replace(/[^a-z0-9]/g, "").slice(0, 24);
  const raw = id && (await redis(["GET", "fb:" + id]));
  if (!raw) throw fail(404, "없는 문의입니다");
  const r = JSON.parse(raw);
  if (null != b.status) {
    if (!FB_STATUS.includes(b.status)) throw fail(400, "상태를 확인해 주세요");
    r.status = b.status;
  }
  null != b.note && (r.note = fbStr(b.note, 500));
  if (null != b.reply) {
    const rep = fbStr(b.reply, 500);
    rep !== r.reply && ((r.reply = rep), (r.replyT = rep ? now() : 0));
  }
  await redis(["SET", "fb:" + id, JSON.stringify(r), "EX", String(90 * 86400)]);
  return { item: r };
};
ADMIN.feedback_del = async (q, b) => {
  const ids = (Array.isArray(b.ids) ? b.ids : [b.id]).map((x) => String(x || "").replace(/[^a-z0-9]/g, "").slice(0, 24)).filter(Boolean).slice(0, 200);
  if (!ids.length) throw fail(400, "지울 문의를 골라 주세요");
  await pipe(ids.flatMap((i) => [["DEL", "fb:" + i], ["LREM", "fb", "0", i]]));
  await log("admin", `문의 ${ids.length}건 삭제`);
  return { deleted: ids.length };
};

// the paid-cheat orders
ADMIN.orders = async (q, b) => {
  const ids = await redis(["LRANGE", "ord", "0", "1999"]);
  const rows = ids.length ? (await pipe(ids.map((i) => ["GET", "ord:" + i]))).filter(Boolean).map((x) => JSON.parse(x)) : [];
  const st = String(b.status || ""),
    s = String(b.q || "").toLowerCase();
  const counts = { total: rows.length, pending: rows.filter((r) => "pending" === r.status).length, sum: rows.filter((r) => "granted" === r.status).reduce((n, r) => n + r.total, 0) };
  const items = rows.filter((r) => (!st || r.status === st) && (!s || JSON.stringify(r).toLowerCase().includes(s))).slice(0, 300);
  const c = await loadConfig();
  return { orders: items, counts, names: orderNames(), on: !!c.order.on, bank: !!c.order.bank };
};
ADMIN.order_set = async (q, b) => {
  const id = String(b.id || "").toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 8);
  const op = String(b.op || "");
  if (!id) throw fail(404, "없는 주문입니다");
  if (!["grant", "reject", "refund", "revoke", "note"].includes(op)) throw fail(400, "알 수 없는 처리");
  return withOrderLock(id, async () => {
    const raw = await redis(["GET", "ord:" + id]);
    if (!raw) throw fail(404, "없는 주문입니다");
    const o = JSON.parse(raw);
    // the books and the log come after the order's new status is saved, so a retry never applies it twice
    let after = null;
    null != b.note && (o.note = fbStr(b.note, 300));
    if ("grant" === op || "refund" === op || "revoke" === op) {
      const u = await getJ(userKey(o.by));
      if (!u) throw fail(404, "계정을 찾을 수 없습니다: " + o.by);
      if ("grant" === op) {
        if ("pending" !== o.status) throw fail(409, "대기 중인 주문만 열어 줄 수 있습니다");
        ensureWallet(u, await loadConfig());
        const prev = orderEnds(u, o),
          perm = applyOrder(u, o);
        await saveUser(u);
        o.status = "granted";
        o.grantedAt = now();
        o.until = perm && o.items.some((k) => !goldOf(k)) ? perm.until : 0;
        // kept for the take-back (see takeBackOrder): the account's end before this order, and this order's own end
        if (o.items.some((k) => !goldOf(k))) { o.prevUntil = prev.until; o.exp = prev.exp; }
        after = async () => {
          await ledgerAdd("paid", o, { t: o.grantedAt, money: o.total, by: String(b.by || "") });
          await log("order", `주문 ${o.id} 열어 줌 · ${o.by} · ${o.items.join(",")}`, { id: o.id, user: o.by });
        };
      } else if ("revoke" === op) {
        // taken back without giving the money back: the cheats and gold this order opened go, the order stays on the books
        if ("granted" !== o.status) throw fail(409, "열어 준 주문만 회수할 수 있습니다");
        await takeBackOrder(u, o);
        await saveUser(u);
        o.status = "revoked";
        o.revokedAt = now();
        o.reason = fbStr(b.reason, 200);
        after = async () => {
          await ledgerAdd("revoke", o, { reason: o.reason });
          await log("order", `주문 ${o.id} 회수 · ${o.by} · ${o.items.join(",")}`, { id: o.id, user: o.by });
        };
      } else {
        if (!["granted", "pending", "revoked"].includes(o.status)) throw fail(409, "이미 처리된 주문입니다");
        if (b.revoke && "granted" === o.status) {
          // what the order gave is taken back by the same rule as a revoke (see takeBackOrder)
          await takeBackOrder(u, o);
          await saveUser(u);
        }
        const paid = "pending" !== o.status;
        o.status = "refunded";
        o.refundedAt = now();
        o.reason = fbStr(b.reason, 200);
        after = async () => {
          await ledgerAdd("refund", o, { money: paid ? -o.total : 0, reason: o.reason });
          await log("order", `주문 ${o.id} 환불${b.revoke ? "·회수" : ""} · ${o.by}`, { id: o.id, user: o.by });
        };
      }
    } else if ("reject" === op) {
      if ("pending" !== o.status) throw fail(409, "대기 중인 주문만 거절할 수 있습니다");
      o.status = "rejected";
      o.reason = fbStr(b.reason, 200);
      after = async () => {
        await ledgerAdd("reject", o, { reason: o.reason });
        await log("order", `주문 ${o.id} 거절 · ${o.by}`, { id: o.id, user: o.by });
      };
    }
    await redis(["SET", "ord:" + id, JSON.stringify(o), "EX", String(400 * 86400)]);
    after && (await after());
    return { order: o };
  });
};
// the books: every money event of the paid orders, newest first, with the totals of what is shown
ADMIN.ledger = async (q, b) => {
  await ledgerSeed();
  const raw = await redis(["LRANGE", "ledger", "0", "19999"]);
  const kind = String(b.kind || ""),
    from = +b.from || 0,
    to = +b.to || 0,
    s = String(b.q || "").toLowerCase();
  const rows = raw.map((x) => JSON.parse(x)).filter((r) => (!kind || r.kind === kind) && (!from || r.t >= from) && (!to || r.t < to) && (!s || JSON.stringify(r).toLowerCase().includes(s)));
  rows.sort((a, c) => c.t - a.t);
  const sum = (k) => rows.filter((r) => r.kind === k).reduce((n, r) => n + (r.money || 0), 0);
  const count = (k) => rows.filter((r) => r.kind === k).length;
  const totals = { paid: sum("paid"), refund: -sum("refund"), net: sum("paid") + sum("refund"), orders: count("order"), paidCount: count("paid"), revoked: count("revoke"), refunded: count("refund"), rejected: count("reject") };
  return { rows: rows.slice(0, 1000), total: rows.length, totals, names: orderNames() };
};
ADMIN.config_get = async () => ({ config: await loadConfig(), defaults: DEFAULT_CONFIG });
ADMIN.config_set = async (q, b) => {
  if (!isObj(b.config)) throw fail(400, "설정이 없습니다");
  const c = merge(DEFAULT_CONFIG, b.config);
  validateConfig(c);
  await setJ("config", c);
  cfgCache = null;
  await log("admin", "설정 저장");
  return { config: c };
};
ADMIN.config_reset = async () => {
  await redis(["DEL", "config"]);
  cfgCache = null;
  await log("admin", "설정 초기화");
  return { config: DEFAULT_CONFIG };
};

const MIN_AGENTS_ON = 10;
function validateConfig(c) {
  const ranges = { "xp.perLevel": [1, 1000000], "game.maxRoomPlayers": [2, 12], "cheat.codeLength": [1, 12], "order.dur.d1": [0, 1000], "order.dur.d7": [0, 1000], "order.dur.d30": [0, 1000], "order.dur.d0": [0, 1000], "cheat.maxSpeed": [1, 3], "cheat.maxFastFire": [1, 10], "gacha.botMaxTier": [0, SKIN_TIERS.max], "room.run": [0, 50], "room.jumpV": [0, 50], "room.gravity": [0, 100], "room.aiSpeed": [0, 50], "aim.strength": [0, 100], "aim.range": [5, 150], "aim.cone": [1, 30], "shop.mix.common": [0, 20], "shop.mix.rare": [0, 20], "shop.mix.epic": [0, 20], "shop.mix.legendary": [0, 20], "shop.knife": [1, 10], "cos.price.1": [0, 1e6], "cos.price.2": [0, 1e6], "cos.price.3": [0, 1e6], "cos.price.4": [0, 1e6], "shop.weekly.off": [0, 90], "shop.weekly.mix.epic": [0, 10], "shop.weekly.mix.legendary": [0, 10], "season.weeks": [1, 26], "season.startDay": [20200101, 20991231], "season.skip": [0, 9999], "season.keep": [0, 100], "season.minPlay": [0, 1000], "season.skinTier": [0, 9] };
  const walk = (base, value, prefix = "") => {
    for (const k of Object.keys(base)) {
      const path = prefix ? prefix + "." + k : k, v = value[k];
      if (typeof base[k] === "number") {
        const [lo, hi] = ranges[path] || [0, 1000000];
        if (typeof v !== "number" || !Number.isFinite(v) || v < lo || v > hi) throw fail(400, "설정 범위를 확인해 주세요: " + path);
      } else if (isObj(base[k])) {
        if (!isObj(v)) throw fail(400, "설정 형식이 이상합니다: " + path);
        walk(base[k], v, path);
      }
    }
  };
  walk(DEFAULT_CONFIG, c);
  c.game.promoNotice = !!c.game.promoNotice;
  if (!Array.isArray(c.channels) || !c.channels.length || c.channels.length > 20 || new Set(c.channels.map((x) => x && x.id)).size !== c.channels.length || c.channels.some((x) => !x || !/^[a-zA-Z0-9_-]{1,20}$/.test(x.id) || typeof x.name !== "string" || !x.name.trim() || x.name.length > 40)) throw fail(400, "서버 목록을 확인해 주세요");
  if (Object.values(c.gacha.odds).every((x) => x === 0)) throw fail(400, "뽑기 확률을 하나 이상 설정해 주세요");
  // agents switched off: only known ids, in roster order; enough must stay on, every role with at least one
  const off = new Set(String(c.game.disabledAgents == null ? "" : c.game.disabledAgents).split(/[\s,]+/).filter(Boolean));
  c.game.disabledAgents = ROSTER.filter((a) => off.has(a.id)).map((a) => a.id).join(",");
  const on = ROSTER.filter((a) => !off.has(a.id));
  if (on.length < MIN_AGENTS_ON || [...new Set(ROSTER.map((a) => a.role))].some((r) => !on.some((a) => a.role === r))) throw fail(400, `요원은 최소 ${MIN_AGENTS_ON}명을 켜 두어야 하고, 역할(타격대·척후대·전략가·감시자)마다 1명 이상 남아야 합니다`);
  const slots = Object.values(c.shop.mix).reduce((a, b) => a + b, 0);
  if (slots < 1 || slots > 40) throw fail(400, "상점 칸 수(등급별 개수의 합)는 1~40개여야 합니다");
}

module.exports = async (req, res) => requestState.run(new Map([["requestIp", ipOf(req)]]), async () => {
  const requestId = crypto.randomUUID();
  res.setHeader('X-Request-Id', requestId);
  res.setHeader("Cache-Control", "no-store");
  res.setHeader("Content-Type", "application/json; charset=utf-8");
  const url = new URL(req.url, "http://x");
  const q = Object.fromEntries(url.searchParams),
    a = q.a || "";
  try {
    const b = "POST" === req.method ? await body(req) : {};
    let out;
    if (a.startsWith("a_")) {
      const s = verify(b.atoken || req.headers["x-admin"]);
      if (!s || "admin" !== s.k || s.pv !== 2) throw fail(401, "관리자 로그인이 필요합니다");
      const fn = Object.hasOwn(ADMIN, a.slice(2)) ? ADMIN[a.slice(2)] : null;
      if (!fn) throw fail(404, "없는 기능");
      for (let attempt = 0; ; attempt++) {
        try { out = await fn(q, b, req); break; }
        catch (e) { if (!e.retryUser || attempt >= 4) throw e; }
      }
    } else {
      const fn = Object.hasOwn(A, a) ? A[a] : null;
      if (!fn) throw fail(404, "없는 기능");
      for (let attempt = 0; ; attempt++) {
        try { out = await fn(q, b, req); break; }
        catch (e) { if (!e.retryUser || attempt >= 4) throw e; }
      }
    }
    RURL && (await flushUse());
    res.statusCode = 200;
    res.end(JSON.stringify(Object.assign({ ok: !0 }, out)));
  } catch (e) {
    res.statusCode = e.code && e.code >= 400 && e.code < 600 ? e.code : 500;
    if (res.statusCode >= 500) {
      const action = new URL(req.url, 'http://localhost').searchParams.get('a') || '';
      console.warn(JSON.stringify({kind:'api-error',requestId,status:res.statusCode,action:/^[a-z_]{1,40}$/.test(action)?action:'invalid'}));
    }
    res.end(JSON.stringify({ ok: !1, error: e.message || String(e), ban: e.ban || undefined, retryable: e.retryUser || undefined }));
  }
});
module.exports.DEFAULT_CONFIG = DEFAULT_CONFIG;
// the pure rating helpers, for the tests
module.exports.rankMath = { MMR_BASE, PLACE_N, mmrFromRR, rrFromMMR, eloExpected, mmrAfter, rrDelta, joinRange, bandOf, canJoinRanked };
module.exports.CATALOG = { guns: GUNS, tiers: SKIN_TIER, only: SKIN_ONLY, items: ITEMS };
module.exports.COS = COS;
module.exports.FB_TYPES = FB_TYPES;
module.exports.ORDER_ITEMS = ORDER_ITEMS;
