// Game backend: accounts (id + password, no e-mail), guests, levels, the
// public room list, bans, server logs, the owner's settings, and the owner's
// admin page. One function, `?a=<action>`. Data lives in Redis (Upstash REST,
// connected from the Vercel dashboard). The owner password is never in the
// repository: it is the ADMIN_MASTER_PASS environment variable.
const crypto = require("crypto");
const SKIN_TIERS = require("../js/skin-tiers");
// every agent of the game (id, name, role): the owner page lists it, the settings keep only these ids
const ROSTER = require("../js/agent-roster.json");
const GAME_RULES = require("../js/game-rules.js");
const SETTINGS_SYNC = require("../js/settings-sync.js");
const MAP_WEEK = require("../js/map-week.js");
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
    // the map of the week: every Monday 0:00 (Korea) one of the maps that are switched off joins the list for the week,
    // the same for everyone. weekMap switches it; weekMapExclude: keys it never picks, comma separated
    weekMap: !0,
    weekMapExclude: "",
    // agents the owner switched off (ids, comma separated): they leave the picker, the bots and the random pick
    disabledAgents: "",
    // chat, quick chat and pings in rooms and matches (off: the buttons are gone and every host drops the messages)
    chat: !0,
    // the e-mail address the contact page (contact.html) shows; empty = none shown. Set by the owner, never in the code
    contactEmail: "",
    // emotes (T): the wheel, the touch button and the bodies that play them; off: the button is gone and every host drops the messages
    emotes: !0,
  },
  cheat: {
    refillSec: 5,
    ultInfinite: !1,
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
  // mastery of each agent, levels 1-10: a match with a valid ticket gives the agent played perMatch, perWin more on a
  // win and perKill a kill, up to maxPerMatch. Level L starts at step * L * (L-1) / 2 XP (step 100: 100, 300, 600 ...
  // 4500). Each level gained pays `gold`, out of the same day's ceiling as the match gold (gold.maxPerDay), and
  // maxGold at most for one match. on: switches the whole thing (nothing counted, nothing shown)
  mastery: { on: !0, perMatch: 30, perWin: 30, perKill: 5, maxPerMatch: 120, step: 100, gold: 50, maxGold: 200 },
  // rewards for the account level (u.xp). Each level gained pays `gold`, and a milestone level also `milestoneGold` and the
  // cosmetic named for it in `milestones` ("level:cosmetic id" pairs, comma separated; no id = gold only; the ids are in
  // js/cosmetics.js). The gold is out of the same day's ceiling as the match gold (gold.maxPerDay), maxGold at most for one
  // match; a cosmetic is not gold and is always given. A level is paid once, whatever the XP rules are changed to later.
  lvReward: { on: !0, gold: 40, maxGold: 400, milestoneGold: 200, milestones: "5:scout,10:neoncity,20:commander,30:galaxy,50:legend13" },
  // the first win of the day (a win with a valid ticket; the day is Korea's, like the other daily counters) pays gold and XP
  // on top of the match, out of the day's gold and XP ceilings
  firstWin: { on: !0, gold: 100, xp: 50 },
  // more missions next to the six below: every day (dCount) and week (wCount) a few are picked from a pool, the same for
  // everyone: win / play / kills (the three targets each, d* a day, w* a week) in one mode, as one role or as one agent.
  // dGold / wGold: what each pays when claimed. A target of 0 leaves that kind of mission out
  mission2: { on: !0, dCount: 2, wCount: 2, dGold: 120, wGold: 400, dPlay: 3, dWin: 2, dKill: 15, wPlay: 8, wWin: 5, wKill: 60 },
  // achievements, once each, from counted matches: the gold each pays (0 = off). roles / modes: a win with every role / in every mode
  ach: { on: !0, win1: 100, kill100: 300, play50: 200, mast5: 400, roles: 500, modes: 800 },
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
  // Ranked play and its rating were removed on 2026-11-07 (the owner's call): what is left under `rank` is what a
  // game needs for leaving, AFK and surrender. The host watches for a player with no input change for afkWarnS
  // seconds (a warning on his screen), then afkLeaveS seconds later he is handed to a bot (0 = no AFK check). A team
  // can vote to surrender from round surrenderRound on (the mode's first surrenderS seconds in the modes without
  // rounds): surrenderVoteS seconds to vote, then surrenderCoolS before the next try; surrenderRound 0 = no surrender.
  rank: { minHumans: 3, leaveGraceS: 60, afkWarnS: 90, afkLeaveS: 30, surrenderRound: 5, surrenderS: 240, surrenderVoteS: 15, surrenderCoolS: 60 },
  // profile cosmetics (titles, name cards, kill effects) bought with gold: the price of one by
  // its tier (1 common … 4 legendary); on switches the whole thing
  cos: { on: !0, price: { 1: 600, 2: 1800, 3: 4500, 4: 10000 } },
  // clans: a clan costs `cost` gold to make and holds `max` members at most (2 to 50); on switches the whole thing
  // (the homepage section, the tags beside names in a game and the clan board)
  clan: { on: !0, cost: 1000, max: 50 },
  // daily and weekly missions: how many (matches, kills, wins) and the gold each pays
  // when claimed. Counted here from the match reports; a day starts at midnight in
  // Korea, a week on Monday. 0 turns a mission off.
  // aim assist: on phones free for everyone (a switch in the game's settings), on a
  // computer only for accounts the owner opened it for (or in admin mode). strength in %, range in metres, cone in
  // degrees; `ranked` is from when there were ranked rooms and changes nothing now
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
  MC.on = !!c.mastery.on;
  MC.step = Math.max(1, Number.isFinite(+c.mastery.step) ? +c.mastery.step : 100);
  AC.on = !!c.ach.on;
  AC.gold = c.ach;
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
const ULOG_FROM_LOG = new Set(["room", "level", "rank", "feedback"]);
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
// wrong passwords one account takes in 15 minutes before it stops taking any (A.auth)
const AUTH_FAIL_MAX = 10;
const PW_NEW_MIN = 8;
// a little brake on guessing passwords
async function limited(key, max, sec) {
  const memo = requestState.getStore();
  const mk = key + "|" + max + "|" + sec;
  if (memo && memo.has(mk)) return memo.get(mk);
  // a window starts on a key with no expiry: the first INCR, or a key whose EXPIRE was lost (it would otherwise count
  // up forever); a live window is never extended. Plain INCR / TTL / EXPIRE only, which every Redis answers.
  const [n, ttl] = await pipe([["INCR", "rl:" + key], ["TTL", "rl:" + key]]);
  ttl < 0 && (await redis(["EXPIRE", "rl:" + key, String(sec)]));
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
// Cheats only count when the owner's admin page (or admin mode) wrote them: cleanPerm stamps `src`. A perm without the
// stamp was left by the old paid-cheat sales; it stays stored but is switched off until the owner saves it again.
const PERM_SRC = "admin";
const permMarked = (p) => isObj(p) && PERM_SRC === p.src;
function cleanPerm(p, days) {
  p = p && "object" == typeof p ? p : {};
  const num = (v, lo, hi, d) => Math.max(lo, Math.min(hi, isFinite(+v) ? +v : d));
  const out = { on: !!p.on, src: PERM_SRC };
  for (const k of PERM_SW) out[k] = !!p[k];
  out.speed = Math.round(num(p.speed, 1, 3, 1) * 100) / 100;
  out.fastFire = Math.round(num(p.fastFire, 1, 10, 1) * 10) / 10;
  out.buff = Math.round(num(p.buff, 0, 120, 0));
  out.until = days > 0 ? now() + days * 864e5 : 0;
  return out;
}
// Each cheat has its own end: ends[k] (0 = permanent). A perm with no ends (made before they existed, or set by the owner
// page) gives every cheat the one `until`. `until` stays the latest end of the cheats that are on (0 if one is permanent).
const permKeys = (p) => [...PERM_SW.filter((k) => p[k]), ...(p.speed > 1 ? ["speed"] : []), ...(p.fastFire > 1 ? ["fastFire"] : []), ...(p.buff > 0 ? ["buff"] : [])];
const permEnd = (p, k) => (isObj(p.ends) && Number.isFinite(p.ends[k]) ? p.ends[k] : +p.until || 0);
const permUntil = (p) => {
  const e = permKeys(p).map((k) => permEnd(p, k));
  return !e.length || e.includes(0) ? 0 : Math.max(...e);
};
// the cheats of a perm that have not run out (null if none); a perm without ends is whole or nothing, as it always was
function permNow(p, t = now()) {
  if (!isObj(p) || !p.on || !permMarked(p)) return null;
  if (!isObj(p.ends)) return p.until && p.until < t ? null : p;
  const q = Object.assign({}, p), ends = {};
  for (const k of permKeys(p)) {
    const e = permEnd(p, k);
    if (e && e < t) {
      if (PERM_SW.includes(k)) q[k] = !1;
      else q[k] = "buff" === k ? 0 : 1;
    } else ends[k] = e;
  }
  q.ends = ends;
  if (!permKeys(q).length) return null;
  q.until = permUntil(q);
  return q;
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
  return u ? permNow(u.perm) : null;
};
// where the account's own cheats live: under the full set admin mode lends (permBefore), or in perm itself
const ownPerm = (u) => (u.permAdmin ? u.permBefore || null : u.perm || null);
const setOwnPerm = (u, p) => (u.permAdmin ? (u.permBefore = p) : (u.perm = p));
// Ranked play was removed (2026-11-07): an account has no RR, MMR, placement, season or AI rating any more, and what
// an older account still carries of them is deleted the next time it is read (rankPurge); the season boards and the
// ranked-match keys go once, on the first request after the update (purgeRankedKeys). The tier a player sees is his
// level (js/tier-level.js).
const RANK_FIELDS = ["rr", "mmr", "placed", "ssn", "ssnLog", "ai", "aiDay", "rrDay", "rmDone"];
function rankPurge(u) {
  let changed = !1;
  for (const k of RANK_FIELDS) Object.hasOwn(u, k) && (delete u[k], (changed = !0));
  return changed;
}
// The rest goes in small steps, at most one a minute on each server, after a request has been answered: first the season
// boards (lb:<season number>) and what ranked matches kept (rm*:), then the accounts, RANK_PURGE_N at a time, from the start
// of the account list to its end (an account that changed meanwhile is skipped: its next read deletes the fields anyway).
// Where it is lives in `purge:ranked` ({ at, users } and then { done }). Nothing else is touched: match history, logs and the
// skins an account owns (월계관 too) stay.
const RANK_PURGE = "purge:ranked", RANK_PURGE_N = 100, RANKED_KEYS = ["lb:*", "rm:*", "rmres:*", "rmroom:*", "rmt:*", "rmv:*", "rmvoid:*", "rmopen:*", "rstart:*"];
let rankPurgeNext = 0;
async function purgeRankedStep() {
  if (now() < rankPurgeNext) return;
  rankPurgeNext = now() + 60000;
  const st = await getJ(RANK_PURGE);
  if (st && st.done) return void (rankPurgeNext = Infinity);
  if (!st) {
    if ((await redis(["SET", RANK_PURGE, JSON.stringify({ at: 0, users: 0, t: now() }), "NX"])) === null) return;
    const keys = new Set();
    for (const pat of RANKED_KEYS) for (const k of (await redis(["KEYS", pat])) || []) (!k.startsWith("lb:") || /^lb:\d+$/.test(k)) && keys.add(k);
    const list = [...keys];
    for (let i = 0; i < list.length; i += 500) await redis(["DEL", ...list.slice(i, i + 500)]);
    return void (await log("admin", `랭크 데이터 삭제: 시즌 순위표와 랭크전 기록 ${list.length}개`));
  }
  const at = Math.max(0, st.at | 0), ids = (await redis(["ZRANGE", "users", String(at), String(at + RANK_PURGE_N - 1)])) || [];
  const raws = ids.length ? (await redis(["MGET", ...ids.map(userKey)])) || [] : [];
  let fixed = 0;
  for (const raw of raws) {
    if (!raw) continue;
    let u;
    try { u = JSON.parse(raw); } catch (e) { continue; }
    if (!isObj(u) || !rankPurge(u)) continue;
    Object.defineProperty(u, SNAPSHOT, { value: raw, writable: true });
    try { await saveUser(u); fixed++; } catch (e) {}
  }
  const users = (st.users | 0) + fixed;
  if (ids.length < RANK_PURGE_N) {
    await setJ(RANK_PURGE, { done: 1, users, t: now() });
    await log("admin", `랭크 데이터 삭제 끝: 계정 ${users}개에서 지움`);
    rankPurgeNext = Infinity;
  } else await setJ(RANK_PURGE, { at: at + ids.length, users, t: st.t });
}
// ── mastery of each agent (u.mast[agentId] = {xp, m: matches, w: wins, k: kills}) ──
const MAST_MAX = 10;
// the owner's numbers, as the last loadConfig() read them (publicUser has no config to hand)
const MC = { on: !0, step: 100 };
// the same for the achievements: on, and the gold of each (config.ach)
const AC = { on: !0, gold: DEFAULT_CONFIG.ach };
// the game sends the agent's name (Korean, as shown); the roster id is taken too, in any case. Anything else is not an agent.
const AGENT_BY = new Map();
for (const a of ROSTER) { AGENT_BY.set(a.id, a.id); AGENT_BY.set(a.name.toLowerCase(), a.id); }
const agentIdOf = (name) => AGENT_BY.get(String(name == null ? "" : name).trim().toLowerCase()) || null;
const mastNeed = (lv) => (Math.max(1, +MC.step || 100) * lv * (lv - 1)) / 2; // the XP level lv starts at
function mastLevel(xp) {
  let lv = 1;
  while (lv < MAST_MAX && xp >= mastNeed(lv + 1)) lv++;
  return lv;
}
// the agents an account has played: level, progress to the next, matches, wins, kills
function mastView(u) {
  const out = {};
  if (!MC.on || !isObj(u.mast)) return out;
  for (const id of Object.keys(u.mast)) {
    const r = u.mast[id];
    if (!AGENT_BY.has(id) || !isObj(r)) continue;
    const xp = Math.max(0, r.xp | 0), lv = mastLevel(xp);
    out[id] = { lv, xp, into: xp - mastNeed(lv), need: lv >= MAST_MAX ? 0 : mastNeed(lv + 1) - mastNeed(lv), m: r.m | 0, w: r.w | 0, k: r.k | 0 };
  }
  return out;
}
// ── achievements (u.ach = {got: {id: when}, roles: {role: 1}, modes: {mode: 1}}; roles and modes are the ones a counted match was won with) ──
const ROLE_ID = { 타격대: "duelist", 감시자: "sentinel", 척후대: "initiator", 전략가: "controller" };
const ROLE_OF = new Map(ROSTER.map((a) => [a.id, ROLE_ID[a.role]]));
const ROLES = [...new Set(ROLE_OF.values())];
// the modes a match is queued in (the target range is practice, not a match); the mode a report names counts only if it is one of these
const MODES = ["std", "swift", "rush", "tdm", "dm", "knife", "gun", "hill", "ctf", "zone", "inf"];
const ACH = [["win1", 1], ["kill100", 100], ["play50", 50], ["mast5", 5], ["roles", ROLES.length], ["modes", MODES.length]];
// the record, read without changing the account; store: put it on the account (an account from before this starts from its last matches)
function achState(u, store) {
  const a = isObj(u.ach) ? u.ach : { got: {}, roles: {}, modes: {} };
  if (!isObj(u.ach)) for (const m of histOf(u)) if (m && m.win) { const r = ROLE_OF.get(agentIdOf(m.agent)); r && (a.roles[r] = 1); MODES.includes(m.mode) && (a.modes[m.mode] = 1); }
  for (const k of ["got", "roles", "modes"]) isObj(a[k]) || (a[k] = {});
  store && (u.ach = a);
  return a;
}
// every achievement with its progress; the ones the owner priced at 0 are left out until they are had
function achView(u) {
  if (!AC.on) return [];
  const a = achState(u), mv = mastView(u), best = Math.max(0, ...Object.values(mv).map((x) => x.lv | 0));
  const have = { win1: u.wins | 0, kill100: u.kills | 0, play50: u.matches | 0, mast5: best, roles: ROLES.filter((r) => a.roles[r]).length, modes: MODES.filter((m) => a.modes[m]).length };
  return ACH.map(([id, n]) => ({ id, have: Math.min(n, have[id]), n, gold: Math.max(0, Math.floor(+AC.gold[id] || 0)), got: a.got[id] | 0 })).filter((x) => x.got || x.gold > 0);
}
// a counted match: the role and the mode of a win; then the achievements that are now reached pay their gold, once each
function achAward(u, win, mode, agent) {
  if (!AC.on) return [];
  const a = achState(u, true);
  if (win) { const r = ROLE_OF.get(agent); r && (a.roles[r] = 1); MODES.includes(mode) && (a.modes[mode] = 1); }
  const out = [];
  for (const x of achView(u)) if (!x.got && x.have >= x.n) { a.got[x.id] = now(); u.gold += x.gold; out.push({ id: x.id, gold: x.gold }); }
  return out;
}
const publicUser = (u, per) => {
  const lv = levelOf(u.xp || 0, per);
  return { id: u.id, guest: !!u.guest, xp: u.xp || 0, level: lv.level, into: lv.into, need: lv.need, kills: u.kills || 0, wins: u.wins || 0, matches: u.matches || 0, admin: !!(u.owner || u.operator || (u.adminUntil && u.adminUntil > now())), owner: !!u.owner, operator: !!(u.operator && !u.owner), adminUntil: u.adminUntil || 0, created: u.created, perm: activePerm(u), adminAllow: isObj(u.adminAllow) ? u.adminAllow : null, gold: "number" == typeof u.gold ? u.gold : 0, championCoins: Number.isSafeInteger(u.championCoins) ? u.championCoins : 0, owned: ownedCount(u), items: ITEMS, pulls: u.pulls || 0, mast: mastView(u), ach: achView(u), fw: u.fwDay === kstDay(now()) ? 1 : 0, misReady: (isObj(u.mis) && u.mis.ready) || 0, aim: aimOf(u), cos: cosOf(u) };
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
// who a player is for owning things (rooms): an account by its id, a guest by its device, never by a shown
// name alone (a guest's name can read the same as an account's)
const ownerKey = (u) => (u.guest ? "g:" + String(u.dev || "").slice(0, 64) : "u:" + u.id.toLowerCase());

// ── gun skins: what there is to win ──
// One item is one skin on one gun. The lists must match the game's (its
// WEAPONS table and GUN_SKINS.list); a test compares them.
const SKIN_TIER = { snow: 1, jungle: 1, desert: 1, urban: 1, navy: 1, carbon: 2, tiger: 2, sakura: 2, celadon: 2, marble: 2, hex: 2, wave: 2, dancheong: 3, ink: 3, gold: 3, neon: 3, circuit: 3, dragon: 3, aurora: 3, lava: 4, galaxy: 4, phoenix: 4, storm: 4, flip: 2, tanto: 3, kukri: 3, karambit: 4, butterfly: 4, butterfly_crimson: 4, butterfly_emerald: 4, butterfly_blackgold: 4, bayonet: 1, gut: 1, bowie: 2, kunai: 3, stiletto: 4, koi: 3, kintsugi: 3, prism: 3, abyss: 4, synth: 4, opal: 4, laurel: 4, champion: 4 };
const WEAPON_DATA = require('../js/weapon-data');
SKIN_TIER.champions_atk = SKIN_TIER.champions_def = 5;
// skins no pull or shop gives: 월계관 was the end of a season's (there are no seasons now: only the owner gives it)
const EXCLUSIVE = { laurel: "season", champions_atk: "coins", champions_def: "coins" };
// skins only one gun can wear (the knives that are other knives)
const SKIN_ONLY = { flip: "knife", tanto: "knife", kukri: "knife", karambit: "knife", butterfly: "knife", butterfly_crimson: "knife", butterfly_emerald: "knife", butterfly_blackgold: "knife", bayonet: "knife", gut: "knife", bowie: "knife", kunai: "knife", stiletto: "knife" };
SKIN_ONLY.champions_atk = SKIN_ONLY.champions_def = WEAPON_DATA.championsWeapon;
const fits = (s, g) => !SKIN_ONLY[s] || SKIN_ONLY[s] === g;
const SKIN_IDS = Object.keys(SKIN_TIER);
const GUNS = ["knife", "pistol", "silenced", "revolver", "machpist", "handcan", "smg", "vector", "pdw", "shotgun", "autoshot", "slugger", "rifle", "carbine", "battle", "burst", "lmg", "hmg", "marksman", "sniper", "stinger", "pocketshot", "ripper", "whisper", "burstsmg", "doublebarrel", "scout", "bullpup", "minigun", "antimat", "rpg"].filter(key => !WEAPON_DATA.aliases[key]);
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
// the six knife skins of a removed third-party pack (legendary, knife only). Nothing records whether a copy came
// from a pull or the shop, so each comes back at the most it could have cost: the shop's legendary knife price
const packKnifeRefund = (c) => Math.max(0, Math.round((+c.shop.price.legendary || 0) * Math.max(1, +c.shop.knife || 1)));
function ensureWallet(u, c) {
  let changed = !1;
  if (!Number.isSafeInteger(u.championCoins) || u.championCoins < 0) { u.championCoins = 0; changed = true; }
  if ("number" != typeof u.gold || !isFinite(u.gold)) ((u.gold = c.gold.signup), (changed = !0));
  if (!isObj(u.own)) ((u.own = {}), (changed = !0));
  // Restore archived copies once when a consolidated weapon returns. Leave
  // current equipment, migrated copies and previous compensation intact.
  for (const key of WEAPON_DATA.restored) {
    if (!Array.isArray(u.weaponArchive?.[key]) || u.weaponRestored?.[key]) continue;
    const archived = u.weaponArchive[key].filter(s => SKIN_TIER[s] && fits(s, key) && !RETIRED[s]);
    u.own[key] = [...new Set([...(Array.isArray(u.own[key]) ? u.own[key] : []), ...archived])];
    if (!isObj(u.weaponRestored)) u.weaponRestored = {};
    u.weaponRestored[key] = true; changed = true;
  }
  // Move all previously sold Champions copies to the renamed Phantom. Preserve
  // ordinary skins, the target's current choice and both currency balances.
  const phantom = (s) => s === "champions_atk" || s === "champions_def";
  const championGun = WEAPON_DATA.championsWeapon;
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
  for (const [old, target] of Object.entries(WEAPON_DATA.aliases)) {
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
    const wish = [...new Set(u.wish.map(value => { if (typeof value !== 'string') return value; const [g,s] = value.split('|'); return WEAPON_DATA.canonical(g) + '|' + s; }))];
    if (JSON.stringify(wish) !== JSON.stringify(u.wish)) { u.wish = wish; changed = true; }
  }
  // The user retained the RGX butterfly. Preserve a still-owned legacy key before
  // refunding the other removed pack knives; the active butterfly key stays stable.
  if (Array.isArray(u.own.knife) && u.own.knife.includes('vp_future_butterfly')) {
    u.own.knife = [...new Set(u.own.knife.map(s => s === 'vp_future_butterfly' ? 'butterfly' : s))];
    if (u.skins?.m?.knife === 'vp_future_butterfly') { u.skins.m.knife = 'butterfly'; u.skins.t = Math.max(+u.skins.t || 0, now()) + 1; }
    changed = true;
  }
  if (Array.isArray(u.wish) && u.wish.includes('knife|vp_future_butterfly')) {
    u.wish = [...new Set(u.wish.map(w => w === 'knife|vp_future_butterfly' ? 'knife|butterfly' : w))]; changed = true;
  }
  for (const g in u.own) {
    if (!Array.isArray(u.own[g])) continue;
    const pack = (s) => WEAPON_DATA.retiredKnives.includes(s);
    const keep = u.own[g].filter((s) => !RETIRED[s] && !pack(s));
    for (const s of u.own[g]) RETIRED[s] && (back += Math.max(0, Math.round(+c.gacha.cost1 || 0)) * (4 === RETIRED[s] ? 3 : 1));
    for (const s of new Set(u.own[g])) pack(s) && (back += packKnifeRefund(c));
    keep.length !== u.own[g].length && ((u.own[g] = keep), (changed = !0));
  }
  if (isObj(u.skins?.m) && WEAPON_DATA.retiredKnives.includes(u.skins.m.knife)) {
    delete u.skins.m.knife; u.skins.t = Math.max(+u.skins.t || 0, now()) + 1; changed = true;
  }
  if (Array.isArray(u.wish) && u.wish.some((w) => typeof w === "string" && WEAPON_DATA.retiredKnives.includes(w.split("|")[1]))) {
    u.wish = u.wish.filter((w) => !(typeof w === "string" && WEAPON_DATA.retiredKnives.includes(w.split("|")[1]))); changed = true;
  }
  if (back) {
    u.gold = Math.min(9e6, u.gold + back);
    u.refunded = (u.refunded || 0) + back;
  }
  rankPurge(u) && (changed = !0);
  changed && trimPicks(u);
  return changed;
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
// the rank settings a game needs to run leaving, AFK and surrender
const publicRank = (R) => { const o = {}; for (const k of ["minHumans", "leaveGraceS", "afkWarnS", "afkLeaveS", "surrenderRound", "surrenderS", "surrenderVoteS", "surrenderCoolS"]) o[k] = Math.max(0, Math.round(+R[k]) || 0); return o; };
// the map of the week for the time (Korea's Monday 0:00 starts a week): { key, week, until } or null when it is switched off
const weekMapOf = (c, t) => {
  const m = MAP_WEEK.choose(t, !1 !== c.game.weekMap, c.game.weekMapExclude);
  return m ? { key: m.key, week: m.week, until: m.until } : null;
};
A.config = async () => {
  const c = await loadConfig();
  return { config: { game: c.game, weekMap: weekMapOf(c, now()), cheat: c.cheat, room: c.room, xp: c.xp, gold: c.gold, gacha: Object.assign({ items: ITEMS, guns: GUNS.length, skins: SKIN_IDS.length }, c.gacha), aim: c.aim, shop: c.shop, mastery: { on: !!c.mastery.on }, rewards: { lv: { on: !!c.lvReward.on, gold: c.lvReward.gold, milestoneGold: c.lvReward.milestoneGold, ms: milestonesOf(c) }, firstWin: { on: !!c.firstWin.on, gold: c.firstWin.gold, xp: c.firstWin.xp }, ach: { on: !!c.ach.on } }, rank: publicRank(c.rank), channels: c.channels }, store: !!RURL };
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
    // wrong passwords count against the account as well as the IP: guesses spread over many addresses stop too
    const failKey = "rl:authfail:" + id.toLowerCase();
    if (+(await redis(["GET", failKey])) >= AUTH_FAIL_MAX) throw fail(429, "이 아이디는 비밀번호를 너무 많이 틀렸습니다. 15분 뒤에 다시 시도하세요");
    if (!checkPw(pw, u.pass)) {
      await limited("authfail:" + id.toLowerCase(), AUTH_FAIL_MAX, 900);
      await log("auth", "비밀번호 틀림: " + id, { ip });
      await ulog(u.id, "loginfail", "비밀번호 틀림", { ip, dev: String(b.device || "").slice(0, 64) });
      // the same sign-in box also signs up: a taken name must say so, not just "wrong password"
      throw fail(401, "이미 있는 아이디입니다. 내 계정이면 비밀번호를 확인하고, 새로 가입하려면 다른 아이디를 쓰세요");
    }
    await redis(["DEL", failKey]);
  } else {
    if (!c.game.registerOpen) throw fail(403, "지금은 새 가입을 받지 않습니다");
    // a new account needs a longer password; accounts made with 4-7 characters before keep signing in with them
    if (pw.length < PW_NEW_MIN) throw fail(400, "새로 가입하는 비밀번호는 " + PW_NEW_MIN + "자 이상이어야 합니다");
    if (RESERVED_ID.test(id)) throw fail(400, "게스트·플레이어로 시작하는 아이디는 쓸 수 없습니다");
    if (PROTO_ID.test(id)) throw fail(400, "쓸 수 없는 아이디입니다");
    // a name a guest already goes by is taken too
    if (await redis(["GET", guestNameKey(id)])) throw fail(409, "이미 쓰이고 있는 이름입니다. 다른 아이디를 쓰세요");
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
  const boss = u.owner && isOwnerId(u.id) && u._s.o === 1,
    // an account the owner made an operator gets the owner's in-game powers too
    operator = !boss && !u.guest && !!u.operator;
  if (!boss && !operator) return { ticket: null };
  const exp = Math.min(u._s.exp, now() + 5 * 60000);
  return { ticket: sign({ k: "owner", id: u.id, room: b.room, p: b.p, v: u.sessionVersion, exp, ...(operator ? { op: 1 } : {}) }), exp };
};
A.owner_check = async (q, b) => {
  const s = verify(b.ticket);
  if (!ownerScope(b.room, b.p) || !s || s.k !== "owner" || s.room !== b.room || s.p !== b.p || !(s.op || isOwnerId(s.id))) return { owner: false, id: null };
  const u = await getJ(userKey(s.id));
  // an operator's ticket counts only while the account still is one (read fresh: taking it away counts at once), and not when banned
  const owner = !!(u && u.sessionVersion === s.v && (s.op ? u.operator && !u.owner && !(await banOf(u, u.dev, u.lastIp)) : u.owner));
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
// [x, y, size]); the newer of two devices wins, as with the skins. And the player's settings (sensitivity, crosshair,
// volumes, keys ...: js/settings-sync.js), each one with its own time so the newest of each wins
const TOUCH_PARTS = ["tb-fire", "tb-fire2", "tb-ads", "tb-jump", "tb-crouch", "tb-rel", "tb-use", "tb-nade", "tb-chat", "tb-ping", "tb-emote", "tab-0", "tab-1", "tab-2", "tab-3", "mb-util", "mini"];
A.prefs = async (q, b) => {
  const u = await who(b.token);
  if (!u) throw fail(401, "다시 로그인해 주세요");
  if (isObj(b.set)) {
    let dirty = !1;
    if (isObj(b.set.touch)) {
      const touch = {};
      const num = (v, lo, hi) => Math.max(lo, Math.min(hi, isFinite(+v) ? +v : lo));
      for (const k of TOUCH_PARTS) { const v = b.set.touch[k]; Array.isArray(v) && 3 === v.length && (touch[k] = [num(v[0], 0, 1), num(v[1], 0, 1), num(v[2], 0.4, 2.5)]); }
      const t = Math.max(0, Math.min(now() + 6e4, +b.t || now()));
      if (!u.prefs || t > (u.prefs.t || 0)) { u.prefs = Object.assign({}, u.prefs, { t, touch }); dirty = !0; }
    }
    if (isObj(b.set.opts)) {
      const o = isObj(u.prefs && u.prefs.o) ? u.prefs.o : {};
      if (SETTINGS_SYNC.merge(o, SETTINGS_SYNC.cleanMap(b.set.opts, now()))) { u.prefs = Object.assign({}, u.prefs, { o }); dirty = !0; }
    }
    dirty && (await saveUser(u));
  }
  const prefs = u.prefs ? Object.assign({}, u.prefs) : null;
  prefs && prefs.o && (prefs.o = SETTINGS_SYNC.cleanMap(prefs.o, now()));
  return { prefs };
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
// ── more missions, picked from a pool ──
// Every day and week the same few for everyone, from a hash of the day (the week) and the server secret, like the daily shop:
// a kind (win / play / kills, in one mode, as one role or as one agent) at a time, the stats varied first. The id says what it is,
// so its progress and its claim stay with it all day (or week) whatever the owner changes.
function dynMissions(c, day, week) {
  const M = c.mission2;
  if (!M || !M.on) return [];
  const off = new Set(String(c.game.disabledAgents || "").split(/[\s,]+/).filter(Boolean));
  const vals = { mode: MODES, role: ROLES, agent: ROSTER.filter((a) => !off.has(a.id)).map((a) => a.id) };
  const out = [];
  for (const [per, key, count, gold, tg] of [["d", day, M.dCount, M.dGold, { play: M.dPlay, wins: M.dWin, kills: M.dKill }], ["w", week, M.wCount, M.wGold, { play: M.wPlay, wins: M.wWin, kills: M.wKill }]]) {
    const h = crypto.createHmac("sha256", SECRET).update(`mis2|${per}|${key}`).digest();
    let st = h.readUInt32LE(0) >>> 0 || 1;
    const rnd = () => ((st = (st * 1664525 + 1013904223) >>> 0), st / 4294967296);
    const kinds = [];
    for (const stat of ["play", "wins", "kills"]) if (Math.round(+tg[stat]) > 0) for (const kind of ["mode", "role", "agent"]) kinds.push([stat, kind]);
    for (let i = kinds.length - 1; i > 0; i--) {
      const j = Math.floor(rnd() * (i + 1));
      [kinds[i], kinds[j]] = [kinds[j], kinds[i]];
    }
    const want = Math.max(0, Math.min(4, Math.floor(+count) || 0)), picked = [];
    for (const k of kinds) picked.length < want && !picked.some((x) => x[0] === k[0]) && picked.push(k);
    for (const k of kinds) picked.length < want && !picked.includes(k) && picked.push(k);
    for (const [stat, kind] of picked) {
      const v = vals[kind][Math.floor(rnd() * vals[kind].length)];
      v && out.push({ id: `${per}x:${stat}:${kind}:${v}`, per, stat, f: { k: kind, v }, n: Math.round(+tg[stat]), gold: Math.max(0, Math.round(+gold) || 0) });
    }
  }
  return out;
}
// does a match (its mode, the agent id, the agent's role) count towards one of them
const dynHit = (x, info) => info.mode && ("mode" === x.f.k ? info.mode === x.f.v : "role" === x.f.k ? info.role === x.f.v : info.agent === x.f.v);
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
  // the picked ones keep their progress and claims for the whole day (week), even if the pool or the owner's numbers change
  for (const id of Object.keys(m.p).concat(Object.keys(m.got))) (("dx:" === id.slice(0, 3) && m.d !== day) || ("wx:" === id.slice(0, 3) && m.w !== week)) && (delete m.p[id], delete m.got[id]);
  m.d = day;
  m.w = week;
  const list = [];
  for (const [id, per, stat, k] of MIS) {
    const n = Math.max(0, Math.round(+M[k] || 0));
    if (!n) continue;
    const have = Math.min(n, m.p[id] || 0);
    list.push({ id, per, stat, n, have, gold: Math.max(0, Math.round(+M[k + "Gold"] || 0)), done: have >= n, got: !!m.got[id] });
  }
  for (const x of dynMissions(c, day, week)) {
    const have = Math.min(x.n, m.p[x.id] || 0);
    list.push(Object.assign(x, { have, done: have >= x.n, got: !!m.got[x.id] }));
  }
  m.ready = list.filter((x) => x.done && !x.got).length;
  // when the day and the week end (ms since 1970)
  const dayEnd = Date.parse(day + "T00:00:00Z") - KST + 864e5,
    weekEnd = Date.parse(week + "T00:00:00Z") - KST + 7 * 864e5;
  return { list, ready: m.ready, dayEnd, weekEnd };
}
function misCount(u, c, add, info) {
  const st = misState(u, c);
  for (const [id, , stat] of MIS) add[stat] > 0 && (u.mis.p[id] = (u.mis.p[id] || 0) + add[stat]);
  if (info) for (const x of st.list) "x" === x.id[1] && dynHit(x, info) && add[x.stat] > 0 && (u.mis.p[x.id] = (u.mis.p[x.id] || 0) + add[x.stat]);
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
  const n = crypto.randomBytes(12).toString("hex"), t0 = now();
  if (await limited("mstart:" + u.id, 12, 600)) throw fail(429, "너무 자주 보냈습니다");
  await redis(["SET", "mt:" + n, String(u.id), "EX", String(Math.ceil(MATCH_MAX_MS / 1000))]);
  return { ticket: sign({ k: "match", u: String(u.id), v: u.sessionVersion, n, t0, exp: t0 + MATCH_MAX_MS }) };
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
  return { ok: !0, key: "mt:" + t.n, receipt: "mr:" + t.n, ms, maxKills: Math.floor(ms / KILL_EVERY_MS) + 1 };
}
// What the room host may know about a player, to set the bots' skill and show a Lv chip: the account level. A guest, an unknown name and a malformed id all read the same (nulls), so this is not a
// way to find out who has an account. Never email, tokens, IP or device.
const lvInfo = (x, per) => {
  if (!x || x.guest) return { level: null };
  const out = { level: levelOf(x.xp || 0, per).level };
  // mastery level of each agent played (an agent missing is level 1); left out when there is none
  const mv = mastView(x), ids = Object.keys(mv);
  if (ids.length) { out.mast = {}; for (const id of ids) out.mast[id] = mv[id].lv; }
  return out;
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
  await clanTagsInto(valid.map((id, i) => [recs[i], users[id]]), await loadConfig());
  return { users };
};
// the milestone levels of the owner's lvReward.milestones ("5:scout,10:neoncity"), a cosmetic id that is not one left out
function milestonesOf(c) {
  const out = [];
  for (const part of String(c.lvReward.milestones || "").split(",")) {
    const [lv, id] = part.trim().split(":"), n = Math.floor(+lv), cos = (id || "").trim();
    Number.isFinite(n) && n >= 2 && n <= 999 && !out.some((x) => x.lv === n) && out.push({ lv: n, cos: COS_BY[cos] ? cos : "" });
  }
  return out.sort((x, y) => x.lv - y.lv);
}
// the levels gained, from the one last paid for (u.lvPaid; an account from before this, or a new one, starts at the level it had)
// to `to`: gold for each, more at a milestone, which also gives its cosmetic. Only the gold is held to `left`, what the day's gold
// ceiling still allows. A level pays once even if the owner's XP rules later make it be reached again. An account from before
// this is given, once, the cosmetics of the milestones it had already passed (back; not their gold), as the homepage shows those
// milestones as reached.
function levelAward(u, c, from, to, left) {
  const R = c.lvReward, known = Number.isSafeInteger(u.lvPaid) && u.lvPaid >= 0, paid = known ? u.lvPaid : from;
  u.lvPaid = Math.max(paid, to);
  if (!R.on) return null;
  const ms = milestonesOf(c), cos = [], back = [], reached = [], per = Math.max(0, Math.floor(+R.gold || 0)), big = Math.max(0, Math.floor(+R.milestoneGold || 0));
  const give = (m) => {
    const me = cosOf(u);
    return !!m.cos && !me.own.includes(m.cos) && ((u.cos = { own: me.own.concat(m.cos), eq: me.eq }), cos.push(m.cos), !0);
  };
  if (!known) for (const m of ms) m.lv <= paid && give(m) && back.push(m.cos);
  if (to <= paid && !back.length) return null;
  let sum = 0;
  for (let lv = paid + 1; lv <= to; lv++) {
    sum += per;
    const m = ms.find((x) => x.lv === lv);
    if (!m) continue;
    sum += big;
    reached.push(lv);
    give(m);
  }
  return { from: paid, to, gold: Math.max(0, Math.min(sum, Math.max(0, Math.floor(+R.maxGold || 0)), left)), cos, ms: reached, ...(back.length ? { back } : {}) };
}
// the mastery of the agent a ticketed match was played with (null: off, or not an agent we know). left: gold still
// allowed today. Counts the match in u.mast and answers what the result screen shows.
function masteryAward(u, c, name, win, kills, left) {
  const M = c.mastery, id = M && M.on ? agentIdOf(name) : null;
  if (!id) return null;
  if (!isObj(u.mast)) u.mast = {};
  const r = isObj(u.mast[id]) ? u.mast[id] : (u.mast[id] = { xp: 0, m: 0, w: 0, k: 0 });
  const before = mastLevel(r.xp | 0);
  const gain = Math.max(0, Math.min(+M.maxPerMatch || 0, (+M.perMatch || 0) + (win ? +M.perWin || 0 : 0) + kills * (+M.perKill || 0)));
  r.xp = (r.xp | 0) + Math.floor(gain);
  r.m = (r.m | 0) + 1;
  r.w = (r.w | 0) + (win ? 1 : 0);
  r.k = (r.k | 0) + kills;
  const lv = mastLevel(r.xp), up = lv - before;
  const gold = up > 0 ? Math.max(0, Math.min(up * Math.max(0, +M.gold || 0), Math.max(0, +M.maxGold || 0), left)) : 0;
  return { id, gain: Math.floor(gain), lv, before, up, gold };
}
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
      return { ...receipt, user, goldLeft: cap > 0 ? user.goldLeft : null, hist: histOf(u), missions: misState(u, c) };
    }
  }
  if (await limited("prog:" + u.id, 1, 20)) throw fail(429, "너무 자주 보냈습니다");
  // Every award requires a valid ticket; replay returns the committed receipt.
  const trust = await matchTrust(u, b.mt);
  if (!trust.ok) throw fail(409, trust.why === "too_short" ? "경기가 너무 짧아 보상을 받을 수 없습니다" : "유효한 경기 확인표가 없습니다");
  // a free-for-all (the server's own list, GAME_RULES.ffaMode) has no sides: its s is [my kills, the top kills], so equal kills
  // is not a draw there; the placing decides, as the game reports it
  const draw = b.outcome === "draw" || (b.match && !GAME_RULES.ffaMode(b.match.mode) && Array.isArray(b.match.s) && b.match.s[0] === b.match.s[1]);
  const kills = trust.ok ? Math.max(0, Math.min(60, trust.maxKills, b.kills | 0)) : 0,
    win = trust.ok && !draw && !!b.win;
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
  // mastery of the agent played: XP for the match, and gold for each level gained out of what is left of the day's ceiling
  const mastery = masteryAward(u, c, b.match && b.match.agent, win, kills, Math.max(0, left - gold));
  mastery && (u.gold += mastery.gold);
  // the first win of the day: its XP (out of what is left of the day's XP ceiling) counts towards the level below; its gold
  // comes last, after the level's, out of what is left of the gold ceiling
  const F = c.firstWin, fwOn = !!(F.on && win && u.fwDay !== day), fwXp = fwOn ? Math.max(0, Math.min(Math.floor(+F.xp) || 0, xleft - gain)) : 0;
  const lvAward = levelAward(u, c, before, levelOf((u.xp || 0) + gain + fwXp, c.xp.perLevel).level, Math.max(0, left - gold - (mastery ? mastery.gold : 0)));
  const fwGold = fwOn ? Math.max(0, Math.min(Math.floor(+F.gold) || 0, left - gold - (mastery ? mastery.gold : 0) - (lvAward ? lvAward.gold : 0))) : 0;
  fwOn && (u.fwDay = day);
  u.gold += (lvAward ? lvAward.gold : 0) + fwGold;
  u.championCoins += coinGain;
  u.coinDay.n = (u.coinDay.n || 0) + coinGain;
  u.goldDay.n = (u.goldDay.n || 0) + gold + (mastery ? mastery.gold : 0) + (lvAward ? lvAward.gold : 0) + fwGold;
  u.xp = (u.xp || 0) + gain + fwXp;
  u.xpDay.n = (u.xpDay.n || 0) + gain + fwXp;
  const m = cleanMatch(b.match, win, kills);
  m && (u.hist = [Object.assign(m, { t: now(), xp: gain, gold, coinGain })].concat(histOf(u)).slice(0, HIST_MAX));
  u.kills = (u.kills || 0) + kills;
  u.wins = (u.wins || 0) + (win ? 1 : 0);
  u.matches = (u.matches || 0) + 1;
  const agent = agentIdOf(b.match && b.match.agent), mode = m && MODES.includes(m.mode) ? m.mode : "";
  const mis = misCount(u, c, { play: 1, kills, wins: win ? 1 : 0 }, { mode, agent, role: ROLE_OF.get(agent) || "" });
  const ach = achAward(u, win, mode, agent);
  const p = publicUser(u, c.xp.perLevel);
  cap > 0 && (p.goldLeft = Math.max(0, cap - u.goldDay.n));
  const out = { trusted: trust.ok, gain, gold, coinGain, goldLeft: cap > 0 ? p.goldLeft : null, user: p, levelUp: p.level > before, hist: histOf(u), missions: mis, mastery, lvReward: lvAward, firstWin: fwOn ? { gold: fwGold, xp: fwXp } : null, ach };
  await saveUser(u, { ticketKey: trust.key, key: trust.receipt, value: out });
  // the all-time boards (kills, XP, wins, matches played) and the clan's XP
  await boardsAfterMatch(u, gain + fwXp);
  await ulog(u.id, "match", `${draw ? "무승부" : win ? "승리" : "패배"} · ${kills}킬${m ? " · " + m.mode + " " + m.map : ""}`, { win: win ? 1 : 0, draw: draw ? 1 : 0, k: kills, xp: gain, dg: gold, gold: u.gold, lv: p.level, lg: lvAward && lvAward.gold || undefined, lc: lvAward && lvAward.cos.length ? lvAward.cos : undefined, fw: fwOn ? [fwGold, fwXp] : undefined, ach: ach.length ? ach.map((x) => x.id) : undefined });
  p.level > before && (await log("level", `${u.id} 레벨 ${p.level}`, { user: u.id }));
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
// The relay (TURN) credentials are billed traffic: only a signed-in player (an account or a guest) gets them, a few times per
// address, and one credential lives 6 hours (the game asks again every 2 hours).
const ICE_TTL = 6 * 3600;
A.ice = async (q, b, req) => {
  if (!(await who(b.token))) throw fail(401, "다시 로그인해 주세요");
  if (await limited("ice:" + ipOf(req), 30, 600)) throw fail(429, "잠시 후 다시 시도하세요");
  if (!TURN_ID || !TURN_TOKEN) return { iceServers: FIXED_ICE, relay: FIXED_ICE.length > 0 };
  if (iceCache && iceCache.until > now()) return { iceServers: iceCache.list, relay: !0 };
  const base = "https://rtc.live.cloudflare.com/v1/turn/keys/" + TURN_ID + "/credentials/";
  const hdr = { Authorization: "Bearer " + TURN_TOKEN, "Content-Type": "application/json" };
  let list = null;
  try {
    const r = await fetchTimed(base + "generate-ice-servers", { method: "POST", headers: hdr, body: JSON.stringify({ ttl: ICE_TTL }) });
    if (r.ok) list = (await r.json()).iceServers;
  } catch (e) {}
  if (!list)
    try {
      const r = await fetchTimed(base + "generate", { method: "POST", headers: hdr, body: JSON.stringify({ ttl: ICE_TTL }) });
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
// a room is its opener's by `hostKey`; a room written before it was kept (gone within ROOM_TTL * 4) goes by the
// name, and a guest's name that an account also has is the account's
async function roomMine(room, u) {
  if (room.hostKey) return room.hostKey === ownerKey(u);
  if (room.host !== u.id) return !1;
  return !u.guest || !(await getJ(userKey(u.id)));
}
A.rooms = async () => {
  const c = await loadConfig();
  if (!c.game.roomListOpen) return { rooms: [] };
  if (roomsCache && roomsCache.until > now()) return { rooms: roomsCache.rooms };
  await redis(["ZREMRANGEBYSCORE", "rooms", "-inf", String(now() - ROOM_TTL * 1000)]);
  // scored by the last heartbeat: the newest 200, not the 200 that went quiet first
  const codes = await redis(["ZRANGE", "rooms", "0", "199", "REV"]);
  const rows = await pipe(codes.map((k) => ["GET", "room:" + k]));
  const rooms = rows.filter(Boolean).map((r) => JSON.parse(r)).filter((r) => !r.private).map(({ code, name, ch, mode, map, players, max, state, host, created }) => ({ code, name, ch, mode, map, n: (players || []).length, max, state, host, created }));
  roomsCache = { rooms, until: now() + 5000 };
  return { rooms };
};
A.room_up = async (q, b, req) => {
  const c = await loadConfig(),
    u = await who(b.token);
  if (!u) throw fail(401, "다시 로그인해 주세요");
  const code = String(b.code || "").toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 6);
  if (6 !== code.length) throw fail(400, "방 코드가 이상합니다");
  const previousRoom = await redis(["GET", "room:" + code]);
  const prev = previousRoom ? JSON.parse(previousRoom) : null;
  if (prev && !(await roomMine(prev, u))) throw fail(409, "다른 사람의 방입니다");
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
    state: String(b.state || "lobby").slice(0, 10),
    host: u.id,
    hostKey: ownerKey(u),
    ip: ipOf(req),
    created: (prev && prev.created) || now(),
    seen: now(),
    banAt: (prev && prev.banAt) || 0,
  };
  const fresh = players.filter((p) => !(prev && (prev.players || []).includes(p)));
  const checkAll = now() - room.banAt > 60000;
  checkAll && (room.banAt = now());
  const toCheck = checkAll ? players : fresh;
  const savedRoom = await casMulti([["room:" + code, previousRoom]], [
    ["SET", "room:" + code, JSON.stringify(room), "EX", String(ROOM_TTL * 4)],
    ["ZADD", "rooms", String(now()), code],
  ]);
  if (!savedRoom) throw fail(409, "방 등록 요청이 겹쳤습니다. 다시 시도해 주세요");
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
  return { cmds: (cmds || []).map((x) => JSON.parse(x)), banned, config: { game: c.game, cheat: c.cheat, room: c.room } };
};
A.room_down = async (q, b) => {
  const u = await who(b.token);
  if (!u) throw fail(401, "다시 로그인해 주세요");
  const code = String(b.code || "").toUpperCase().slice(0, 6);
  const prev = await getJ("room:" + code);
  if (prev && (await roomMine(prev, u))) {
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
  const S = { users: ids.length, scanned: 0, bought: 0, spent: 0, new1: 0, new7: 0, act1: 0, act7: 0, gold: 0, pulls: 0, owned: 0, matches: 0, kills: 0, wins: 0, admins: 0, perms: 0, aimPc: 0, aimMobileOff: 0, banned: 0, signups: Array(14).fill(0) };
  const top = [];
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
    (u.owner || u.operator || (u.adminUntil && u.adminUntil > t)) && S.admins++;
    activePerm(u) && S.perms++;
    const a = aimOf(u);
    a.pc && S.aimPc++;
    a.mobile || S.aimMobileOff++;
    u.ban && (!u.ban.until || u.ban.until > t) && S.banned++;
    const ago = Math.floor((d0.getTime() + 864e5 - 1 - (u.created || 0)) / 864e5);
    ago >= 0 && ago < 14 && S.signups[13 - ago]++;
    top.push({ id: u.id, kills: u.kills || 0, wins: u.wins || 0, matches: u.matches || 0, level: levelOf(u.xp || 0, c.xp.perLevel).level });
  }
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
  const R = { open: rows.length, people: 0, playing: 0, modes: {} };
  for (const r of rows) {
    R.people += (r.players || []).length;
    "lobby" !== r.state && R.playing++;
    R.modes[r.mode || "?"] = (R.modes[r.mode || "?"] || 0) + 1;
  }
  return { summary: S, logs: L, recent, rooms: R, items: ITEMS, config: { game: c.game, aim: c.aim, gacha: c.gacha, gold: c.gold, rank: c.rank, shop: c.shop }, shop: c.shop.on ? shopOf(c, kstDay(t)) : [], shopReset: nextKstMidnight(t), weekly: c.shop.on ? weeklyOf(c, kstWeek(t)) : [], weeklyReset: nextKstMonday(t), t };
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
    const cur = permNow(u.perm, t),
      full = Object.assign({ on: !0, speed: 3, fastFire: 10, buff: Math.max(10, (cur && cur.buff) || 0) }, Object.fromEntries(PERM_SW.map((k) => [k, !0])));
    const out = cleanPerm(full, 0);
    // whatever the account already had keeps its own end if that is later (or none)
    out.until = cur && (!cur.until || cur.until > u.adminUntil) ? cur.until : u.adminUntil;
    // an unmarked (old, switched off) perm is kept as it was so the revert below gives it back untouched
    if (!u.permAdmin) u.permBefore = cur || (isObj(u.perm) && !permMarked(u.perm) ? u.perm : null);
    u.perm = out;
    u.permAdmin = !0;
  } else if (u.permAdmin) {
    u.perm = u.permBefore || Object.assign({}, u.perm || {}, { on: !1 });
    delete u.permAdmin;
    delete u.permBefore;
  }
}
// the owner's changes to an account, as its own log shows them
const OP_KO = { operator: "운영자 권한", ban: "차단", unban: "차단 해제", admin: "관리자 모드", xp: "경험치 설정", level: "레벨 설정", password: "비밀번호 변경", note: "메모", perm: "치트 권한", aim: "에임 보정", gold: "골드 설정", grant: "스킨 지급" };
const opNote = (b, u, was) => ("operator" === b.op ? (b.on ? " 줌" : " 뺌") : "ban" === b.op ? (b.days > 0 ? ` ${b.days}일` : " 영구") + (b.reason ? ` (${String(b.reason).slice(0, 60)})` : "") : "gold" === b.op ? ` ${was.gold ?? 0} → ${u.gold}` : "grant" === b.op ? (b.remove ? " 회수 " : " ") + (Array.isArray(b.items) ? b.items.length + "개" : b.item === "all" ? "전부" : String(b.item || "").slice(0, 40)) : "level" === b.op || "xp" === b.op ? ` ${was.xp || 0} → ${u.xp} xp` : "");
ADMIN.user_set = async (q, b) => {
  const id = cleanId(b.id),
    u = await getJ(userKey(id));
  if (!u) throw fail(404, "없는 아이디");
  const c = await loadConfig(),
    d = b.days > 0 ? now() + b.days * 864e5 : 0,
    was = { gold: u.gold, xp: u.xp };
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
    case "operator":
      // the owner's in-game panel (every cheat, room-wide settings, the player tab), not the owner page
      if (u.guest) throw fail(400, "게스트는 운영자로 만들 수 없습니다");
      b.on ? (u.operator = !0) : delete u.operator;
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
  await log("admin", `계정 ${id}: ${b.op}${b.days ? " " + b.days + "일" : ""}${b.reason ? " (" + b.reason + ")" : ""}${"gold" === b.op ? " " + u.gold : ""}${"grant" === b.op ? " " + (Array.isArray(b.items) ? b.items.length + "개" : b.item) + (b.remove ? " 회수" : "") : ""}${"aim" === b.op ? ` PC ${b.pc ? "켬" : "끔"} · 모바일 ${!1 !== b.mobile ? "켬" : "끔"}` : ""}`);
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
  const [lines, global, fbIds] = await pipe([["LRANGE", ulogKey(id), "0", String(ULOG_MAX - 1)], ["LRANGE", "logs", "0", "1999"], ["LRANGE", "fbu:" + me, "0", "19"]]);
  const parse = (x) => {
    try { return JSON.parse(x); } catch (e) { return null; }
  };
  const own = (lines || []).map(parse).filter((e) => e && e.t && e.k);
  if (!u && !own.length) throw fail(404, "없는 아이디");
  const recs = ((fbIds || []).length ? await pipe((fbIds || []).map((i) => ["GET", "fb:" + i])) : []).map((x) => (x ? parse(x) : null));
  const feedback = recs.filter(Boolean).map((f) => ({ id: f.id, t: f.t, type: f.type, title: f.title, status: f.status }));
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
  const out = { id: u ? u.id : id, found: !!u, log: timeline.slice(0, 900), since, capped: own.length >= ULOG_MAX, agg, feedback, t };
  if (!u) return { profile: out };
  const lv = levelOf(u.xp || 0, c.xp.perLevel),
    tiers = {},
    guns = {};
  if (isObj(u.own)) for (const g in u.own) if (Array.isArray(u.own[g])) for (const s of u.own[g]) SKIN_TIER[s] && (tiers[SKIN_TIER[s]] = (tiers[SKIN_TIER[s]] || 0) + 1, guns[g] = (guns[g] || 0) + 1);
  const ban = u.ban ? Object.assign({ active: !u.ban.until || u.ban.until > t }, u.ban) : null;
  const acct = {
    id: u.id, guest: !!u.guest, created: u.created || 0, lastSeen: u.lastSeen || 0, lastIp: u.lastIp || "", dev: u.dev || "",
    level: lv.level, xp: u.xp || 0, into: lv.into, need: lv.need, gold: "number" == typeof u.gold ? u.gold : 0, championCoins: Number.isSafeInteger(u.championCoins) ? u.championCoins : 0,
    pulls: u.pulls || 0, bought: u.bought || 0, cosBought: u.cosBought || 0, spent: u.spent || 0, refunded: u.refunded || 0,
    kills: u.kills || 0, wins: u.wins || 0, matches: u.matches || 0,
    owner: !!u.owner, operator: !!u.operator, admin: !!(u.owner || u.operator || (u.adminUntil && u.adminUntil > t)), adminUntil: u.adminUntil || 0, adminAllow: isObj(u.adminAllow) ? u.adminAllow : null,
    permActive: !!activePerm(u), permLegacy: !!(isObj(u.perm) && u.perm.on && !permMarked(u.perm)), perm: u.perm || null, aim: aimOf(u), ban, note: u.note || "",
    // the hidden rating is for the owner page only
    owned: { total: ownedCount(u), items: ITEMS, byTier: tiers, byGun: guns },
    equipped: (u.skins && isObj(u.skins.m) && u.skins.m) || {},
    wish: cleanWish(u), missions: misState(u, c), cos: cosOf(u),
    goldDay: isObj(u.goldDay) ? u.goldDay : null, xpDay: isObj(u.xpDay) ? u.xpDay : null, coinDay: isObj(u.coinDay) ? u.coinDay : null,
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

// the owner's own default ("config:default": { config, t }), merged over the built-in one like loadConfig does
const readDefault = async () => {
  const d = await getJ("config:default");
  return d && isObj(d.config) ? { config: JSON.parse(JSON.stringify(merge(DEFAULT_CONFIG, d.config))), t: +d.t || 0 } : null;
};
ADMIN.config_get = async () => ({ config: await loadConfig(), defaults: DEFAULT_CONFIG, saved: await readDefault() });
ADMIN.config_set = async (q, b) => {
  if (!isObj(b.config)) throw fail(400, "설정이 없습니다");
  const c = merge(DEFAULT_CONFIG, b.config);
  validateConfig(c);
  await setJ("config", c);
  cfgCache = null;
  await log("admin", "설정 저장");
  return { config: c };
};
// "save these settings as my default": the same checks as config_set, then both keys in one go
ADMIN.config_default_set = async (q, b) => {
  if (!isObj(b.config)) throw fail(400, "설정이 없습니다");
  const c = merge(DEFAULT_CONFIG, b.config);
  validateConfig(c);
  const saved = { config: c, t: now() }, v = JSON.stringify(c);
  await pipe([["SET", "config", v], ["SET", "config:default", JSON.stringify(saved)]]);
  cfgCache = null;
  await log("admin", "설정을 기본값으로 저장");
  return { config: c, saved };
};
// back to the owner's saved default (b.to "factory": the built-in values). The shop's reroll numbers stay as they
// are: older ones would bring back an earlier shop list.
ADMIN.config_reset = async (q, b) => {
  const factory = b.to === "factory", saved = factory ? null : await readDefault();
  const cur = merge(DEFAULT_CONFIG, (await getJ("config")) || {});
  const c = JSON.parse(JSON.stringify(saved ? saved.config : DEFAULT_CONFIG)); // a copy: merge() shares the nested objects it does not change
  c.shop.reroll = cur.shop.reroll; c.shop.weekly.reroll = cur.shop.weekly.reroll;
  saved && validateConfig(c);
  await setJ("config", c);
  cfgCache = null;
  await log("admin", saved ? "설정을 기본값으로 되돌림" : "설정을 처음 값으로 되돌림");
  return { config: c, to: saved ? "saved" : "factory" };
};

const MIN_AGENTS_ON = 10;
function validateConfig(c) {
  const ranges = { "xp.perLevel": [1, 1000000], "mastery.step": [1, 100000], "mastery.perMatch": [0, 10000], "mastery.perWin": [0, 10000], "mastery.perKill": [0, 10000], "mastery.maxPerMatch": [0, 10000], "mastery.gold": [0, 10000], "mastery.maxGold": [0, 100000], "game.maxRoomPlayers": [2, 12], "gacha.botMaxTier": [0, SKIN_TIERS.max], "room.run": [0, 50], "room.jumpV": [0, 50], "room.gravity": [0, 100], "room.aiSpeed": [0, 50], "aim.strength": [0, 100], "aim.range": [5, 150], "aim.cone": [1, 30], "shop.mix.common": [0, 20], "shop.mix.rare": [0, 20], "shop.mix.epic": [0, 20], "shop.mix.legendary": [0, 20], "shop.knife": [1, 10], "cos.price.1": [0, 1e6], "cos.price.2": [0, 1e6], "cos.price.3": [0, 1e6], "cos.price.4": [0, 1e6], "shop.weekly.off": [0, 90], "shop.weekly.mix.epic": [0, 10], "shop.weekly.mix.legendary": [0, 10], "mission2.dCount": [0, 4], "mission2.wCount": [0, 4], "lvReward.gold": [0, 100000], "lvReward.maxGold": [0, 1000000], "lvReward.milestoneGold": [0, 100000], "firstWin.gold": [0, 100000], "firstWin.xp": [0, 100000] };
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
  c.game.contactEmail = String(c.game.contactEmail == null ? "" : c.game.contactEmail).trim();
  if (c.game.contactEmail && (c.game.contactEmail.length > 80 || !/^[^\s@<>"'&]+@[^\s@<>"'&]+\.[^\s@<>"'&]+$/.test(c.game.contactEmail))) throw fail(400, "문의 이메일 형식을 확인해 주세요");
  c.clan.on = !!c.clan.on;
  if (c.clan.max < 2 || c.clan.max > 50) throw fail(400, "설정 범위를 확인해 주세요: clan.max");
  c.mastery.on = !!c.mastery.on;
  for (const k of ["lvReward", "firstWin", "mission2", "ach"]) c[k].on = !!c[k].on;
  for (const part of String(c.lvReward.milestones).split(",").map((x) => x.trim()).filter(Boolean)) {
    const [lv, id] = part.split(":");
    if (!/^\d{1,3}$/.test(lv) || +lv < 2 || (id !== undefined && !COS_BY[id.trim()])) throw fail(400, "레벨 보상 목록을 확인해 주세요 (예: 5:scout,10:neoncity): " + part);
  }
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

// ── clans ──
// A clan is `clan:<id>` = { id, name, tag, desc, owner, members: [{ id, at }] (oldest first), at }. The unique name and tag are
// reserved by `cname:<key>` / `ctag:<key>` (the clan's id; the key is the text in lower case, a name's spaces left out), and the
// sorted set `clans` lists every clan as "<name key>|<tag key>|<id>" (score 0) for the search. An account holds its clan's id in
// `u.clan`. Every change that touches the clan and an account together (or the reservations, the index and the clan board) goes
// through casMulti: ONE script that checks that the keys it read are still as read and only then writes them all, so two
// parallel joins into the last seat cannot both get in and a name cannot be taken twice. A request that lost the race is run
// again from fresh data (retryUser, as for the account record). u.clan is believed only while the clan lists the account.
const WORD_FILTER = require("../js/word-filter.js");
const CLAN_SEAT_MAX = 50, CLAN_DESC_MAX = 60, CLAN_INDEX = "clans";
const BOARDS = { kills: "lb:all:kills", level: "lb:all:xp", wins: "lb:all:wins", matches: "lb:all:matches", clan: "lb:all:clan" };
const MULTI_CAS = `-- multi-cas
local m = tonumber(ARGV[1])
for i = 1, m do
  if (redis.call('GET', KEYS[i]) or '') ~= ARGV[i + 1] then return 0 end
end
for _, op in ipairs(cjson.decode(ARGV[m + 2])) do
  local cmd = {op[1], KEYS[op[2]]}
  for j = 3, #op do cmd[#cmd + 1] = op[j] end
  redis.call(unpack(cmd))
end
return 1`;
// guards: [[key, the value read (null: not there)]]; ops: [[command, key, ...args]]. true when all were written.
async function casMulti(guards, ops) {
  const keys = guards.map((g) => g[0]);
  const wire = ops.map((o) => {
    let at = keys.indexOf(o[1]);
    at < 0 && (at = keys.push(o[1]) - 1);
    return [o[0], at + 1, ...o.slice(2).map(String)];
  });
  return +(await redis(["EVAL", MULTI_CAS, String(keys.length), ...keys, String(guards.length), ...guards.map((g) => (g[1] == null ? "" : g[1])), JSON.stringify(wire)])) === 1;
}
const retryAgain = () => Object.assign(fail(409, "다른 요청과 겹쳤습니다. 다시 시도해 주세요"), { retryUser: true });
const clanOn = (c) => { if (!c.clan.on) throw fail(403, "클랜은 지금 쓸 수 없습니다"); };
const clanId = (v) => (/^[0-9a-f]{12}$/.test(String(v || "")) ? String(v) : "");
const cKey = (id) => "clan:" + id, cNameKey = (k) => "cname:" + k, cTagKey = (k) => "ctag:" + k;
const nameKeyOf = (n) => String(n).toLowerCase().replace(/ /g, ""), tagKeyOf = (t) => String(t).toLowerCase();
const clanIdx = (cl) => nameKeyOf(cl.name) + "|" + tagKeyOf(cl.tag) + "|" + cl.id;
const CLAN_JUNK = /[\u0000-\u001f\u007f-\u009f\u200b-\u200f\u2028-\u202e\u2066-\u2069\ufeff<>&"]/g;
const cleanClanName = (v) => String(v == null ? "" : v).replace(CLAN_JUNK, "").replace(/\s+/g, " ").trim();
const cleanClanDesc = (v) => String(v == null ? "" : v).replace(CLAN_JUNK, " ").replace(/\s+/g, " ").trim();
// the name and tag a clan is made with (or renamed to): shape, then the swear filter the chat uses
// (the owner, renaming, is trusted with the words)
function checkClanText(name, tag, trusted) {
  if (name !== undefined && (name.length < 2 || name.length > 16 || !/^[A-Za-z0-9가-힣]+(?: [A-Za-z0-9가-힣]+)*$/.test(name))) throw fail(400, "클랜 이름은 2~16자 (한글·영문·숫자, 낱말 사이 띄어쓰기 하나)");
  if (tag !== undefined && !/^[A-Za-z0-9가-힣]{2,4}$/.test(tag)) throw fail(400, "클랜 태그는 2~4자 (한글·영문·숫자)");
  if (!trusted && ((name !== undefined && (WORD_FILTER.has(name) || WORD_FILTER.has(name.replace(/ /g, "")))) || (tag !== undefined && WORD_FILTER.has(tag)))) throw fail(400, "쓸 수 없는 말이 들어 있습니다");
}
function checkClanDesc(desc) {
  if (desc.length > CLAN_DESC_MAX) throw fail(400, `클랜 소개는 ${CLAN_DESC_MAX}자까지입니다`);
  if (WORD_FILTER.has(desc)) throw fail(400, "쓸 수 없는 말이 들어 있습니다");
}
const userJson = (u) => JSON.stringify(Object.assign({}, u, { _s: undefined }));
async function clanRead(id) {
  if (!id) return { clan: null, raw: null };
  const raw = await redis(["GET", cKey(id)]);
  return { clan: raw ? JSON.parse(raw) : null, raw: raw || null };
}
const inClan = (cl, id) => !!cl && cl.members.some((m) => String(m.id).toLowerCase() === String(id).toLowerCase());
// the clan an account really belongs to (its u.clan counts only while the clan still lists it)
async function clanOfUser(u) {
  const { clan, raw } = await clanRead(clanId(u.clan));
  return inClan(clan, u.id) ? { clan, raw } : null;
}
function clanSeats(c) { return Math.max(2, Math.min(CLAN_SEAT_MAX, Math.floor(+c.clan.max) || CLAN_SEAT_MAX)); }
// the clan with its members' levels (read from the accounts) and its XP; the clan board's number is set right while at it
async function clanView(cl, c) {
  const recs = (await pipe(cl.members.map((m) => ["GET", userKey(m.id)]))).map((x) => (x ? JSON.parse(x) : null));
  const members = cl.members.map((m, i) => {
    const r = recs[i];
    return { id: r ? r.id : m.id, level: r ? levelOf(r.xp || 0, c.xp.perLevel).level : 1, xp: r ? r.xp || 0 : 0, role: String(m.id).toLowerCase() === String(cl.owner).toLowerCase() ? "owner" : "member", at: m.at };
  });
  const xp = members.reduce((s, m) => s + m.xp, 0);
  try { await redis(["ZADD", BOARDS.clan, String(xp), cl.id]); } catch (e) {}
  return { id: cl.id, name: cl.name, tag: cl.tag, desc: cl.desc || "", owner: cl.owner, n: members.length, max: clanSeats(c), xp, at: cl.at, members };
}
const clanBrief = (cl, c) => ({ id: cl.id, name: cl.name, tag: cl.tag, desc: cl.desc || "", n: cl.members.length, max: clanSeats(c) });
const clanPublicCfg = (c) => ({ on: !!c.clan.on, cost: Math.max(0, Math.floor(+c.clan.cost) || 0), max: clanSeats(c) });
const outOfClan = (u) => { delete u.clan; };

// my clan (null: none), and the numbers the homepage needs
A.clan_mine = async (q, b) => {
  const c = await loadConfig(), u = await who(b.token);
  if (!u) throw fail(401, "다시 로그인해 주세요");
  const cfg = clanPublicCfg(c);
  if (!cfg.on || u.guest) return { clan: null, cfg };
  const m = await clanOfUser(u);
  return { clan: m ? await clanView(m.clan, c) : null, cfg };
};
A.clan_get = async (q, b) => {
  const c = await loadConfig();
  clanOn(c);
  if (await limited("clanq:" + (requestState.getStore()?.get("requestIp") || "-"), 120, 60)) throw fail(429, "너무 자주 보냈습니다");
  const { clan } = await clanRead(clanId(b.id));
  if (!clan) throw fail(404, "없는 클랜입니다");
  return { clan: await clanView(clan, c) };
};
// by name or tag (a piece of either, any case); no text: the clans with the most XP
A.clan_search = async (q, b) => {
  const c = await loadConfig();
  clanOn(c);
  if (await limited("clanq:" + (requestState.getStore()?.get("requestIp") || "-"), 120, 60)) throw fail(429, "너무 자주 보냈습니다");
  const text = String(b.q == null ? "" : b.q).toLowerCase().replace(/[\s|]/g, "").slice(0, 16);
  let ids;
  if (!text) ids = (await redis(["ZRANGE", BOARDS.clan, "0", "19", "REV"])) || [];
  else {
    const hits = ((await redis(["ZRANGE", CLAN_INDEX, "0", "-1"])) || []).map((x) => x.split("|")).filter(([nk, tk]) => nk.includes(text) || tk.includes(text));
    // a tag that is exactly the text first, then names and tags that start with it, then the rest by name
    const rank = ([nk, tk]) => (tk === text ? 0 : nk === text ? 1 : tk.startsWith(text) || nk.startsWith(text) ? 2 : 3);
    ids = hits.sort((p, r) => rank(p) - rank(r) || (p[0] < r[0] ? -1 : p[0] > r[0] ? 1 : 0)).slice(0, 20).map((x) => x[2]);
  }
  const recs = ids.length ? (await pipe(ids.map((id) => ["GET", cKey(id)]))).map((x) => (x ? JSON.parse(x) : null)) : [];
  return { clans: recs.filter(Boolean).map((cl) => clanBrief(cl, c)), cfg: clanPublicCfg(c) };
};
A.clan_create = async (q, b) => {
  const c = await loadConfig();
  clanOn(c);
  const u = await who(b.token);
  if (!u) throw fail(401, "다시 로그인해 주세요");
  if (u.guest) throw fail(403, "게스트는 클랜을 쓸 수 없습니다. 계정을 만들어 주세요");
  const name = cleanClanName(b.name), tag = cleanClanName(b.tag), desc = cleanClanDesc(b.desc);
  checkClanText(name, tag);
  checkClanDesc(desc);
  // a typo does not count: only a try that got as far as the name being looked up
  if (await limited("clanmk:" + u.id, 10, 3600)) throw fail(429, "너무 자주 보냈습니다");
  if (await clanOfUser(u)) throw fail(409, "이미 클랜에 들어 있습니다");
  ensureWallet(u, c);
  const cost = Math.max(0, Math.floor(+c.clan.cost) || 0);
  if (u.gold < cost) throw fail(402, `골드가 부족합니다 (${cost.toLocaleString()} 필요)`);
  const cl = { id: crypto.randomBytes(6).toString("hex"), name, tag, desc, owner: u.id, members: [{ id: u.id, at: now() }], at: now() };
  u.gold -= cost;
  u.clan = cl.id;
  const ok = await casMulti(
    [[userKey(u.id), u[SNAPSHOT]], [cKey(cl.id), null], [cNameKey(nameKeyOf(name)), null], [cTagKey(tagKeyOf(tag)), null]],
    [["SET", userKey(u.id), userJson(u)], ["SET", cKey(cl.id), JSON.stringify(cl)], ["SET", cNameKey(nameKeyOf(name)), cl.id], ["SET", cTagKey(tagKeyOf(tag)), cl.id], ["ZADD", CLAN_INDEX, "0", clanIdx(cl)], ["ZADD", BOARDS.clan, String(u.xp || 0), cl.id]]
  );
  if (!ok) {
    const [n, t] = await pipe([["GET", cNameKey(nameKeyOf(name))], ["GET", cTagKey(tagKeyOf(tag))]]);
    if (n) throw fail(409, "이미 있는 클랜 이름입니다");
    if (t) throw fail(409, "이미 있는 클랜 태그입니다");
    throw retryAgain();
  }
  await ulog(u.id, "clan", `클랜 만들기 [${tag}] ${name}`, { dg: -cost, gold: u.gold });
  return { clan: await clanView(cl, c), gold: u.gold };
};
A.clan_join = async (q, b) => {
  const c = await loadConfig();
  clanOn(c);
  const u = await who(b.token);
  if (!u) throw fail(401, "다시 로그인해 주세요");
  if (u.guest) throw fail(403, "게스트는 클랜을 쓸 수 없습니다. 계정을 만들어 주세요");
  if (await limited("clanjn:" + u.id, 10, 600)) throw fail(429, "너무 자주 보냈습니다");
  if (await clanOfUser(u)) throw fail(409, "이미 클랜에 들어 있습니다");
  const { clan: cl, raw } = await clanRead(clanId(b.id));
  if (!cl) throw fail(404, "없는 클랜입니다");
  if (cl.members.length >= clanSeats(c)) throw fail(409, "클랜이 가득 찼습니다");
  const next = Object.assign({}, cl, { members: cl.members.concat({ id: u.id, at: now() }) });
  u.clan = cl.id;
  const ok = await casMulti([[cKey(cl.id), raw], [userKey(u.id), u[SNAPSHOT]]], [["SET", cKey(cl.id), JSON.stringify(next)], ["SET", userKey(u.id), userJson(u)], ["ZINCRBY", BOARDS.clan, String(u.xp || 0), cl.id]]);
  if (!ok) throw retryAgain();
  await ulog(u.id, "clan", `클랜 가입 [${cl.tag}] ${cl.name}`, { clan: cl.id });
  return { clan: await clanView(next, c) };
};
// the commands that take `id` out of a clan (read as `cl`, `raw`): the clan goes with its last member, and the
// oldest member takes over when the owner goes. `rec`: the account's record, which loses its u.clan (null: gone)
function clanDrop(cl, raw, id, rec, xp = rec ? rec.xp || 0 : 0) {
  const rest = cl.members.filter((m) => String(m.id).toLowerCase() !== String(id).toLowerCase());
  const guards = [[cKey(cl.id), raw]], ops = [];
  if (rec) { guards.push([userKey(rec.id), rec[SNAPSHOT]]); outOfClan(rec); ops.push(["SET", userKey(rec.id), userJson(rec)]); }
  if (!rest.length) ops.push(["DEL", cKey(cl.id)], ["DEL", cNameKey(nameKeyOf(cl.name))], ["DEL", cTagKey(tagKeyOf(cl.tag))], ["ZREM", CLAN_INDEX, clanIdx(cl)], ["ZREM", BOARDS.clan, cl.id]);
  else {
    const owner = String(cl.owner).toLowerCase() === String(id).toLowerCase() ? rest[0].id : cl.owner;
    ops.push(["SET", cKey(cl.id), JSON.stringify(Object.assign({}, cl, { owner, members: rest }))], ["ZINCRBY", BOARDS.clan, String(-xp), cl.id]);
  }
  return { guards, ops, rest };
}
A.clan_leave = async (q, b) => {
  const c = await loadConfig(), u = await who(b.token);
  clanOn(c);
  if (!u) throw fail(401, "다시 로그인해 주세요");
  if (u.guest) throw fail(403, "게스트는 클랜을 쓸 수 없습니다. 계정을 만들어 주세요");
  if (await limited("clanlv:" + u.id, 10, 600)) throw fail(429, "너무 자주 보냈습니다");
  const m = await clanOfUser(u);
  if (!m) {
    // a pointer to a clan that is gone or no longer lists the account: just cleared
    if (u.clan) { outOfClan(u); await saveUser(u); return { clan: null }; }
    throw fail(409, "클랜에 들어 있지 않습니다");
  }
  const d = clanDrop(m.clan, m.raw, u.id, u);
  if (!(await casMulti(d.guards, d.ops))) throw retryAgain();
  await ulog(u.id, "clan", `클랜 탈퇴 [${m.clan.tag}] ${m.clan.name}`, { clan: m.clan.id });
  return { clan: null };
};
A.clan_kick = async (q, b) => {
  const c = await loadConfig(), u = await who(b.token);
  clanOn(c);
  if (!u) throw fail(401, "다시 로그인해 주세요");
  if (u.guest) throw fail(403, "게스트는 클랜을 쓸 수 없습니다. 계정을 만들어 주세요");
  if (await limited("clanop:" + u.id, 30, 600)) throw fail(429, "너무 자주 보냈습니다");
  const m = await clanOfUser(u);
  if (!m) throw fail(409, "클랜에 들어 있지 않습니다");
  if (String(m.clan.owner).toLowerCase() !== u.id.toLowerCase()) throw fail(403, "클랜장만 할 수 있습니다");
  const target = cleanId(b.id);
  if (target.toLowerCase() === u.id.toLowerCase()) throw fail(400, "자기 자신은 내보낼 수 없습니다");
  if (!inClan(m.clan, target)) throw fail(404, "그 사람은 이 클랜에 없습니다");
  const rec = await getJ(userKey(target));
  // an account that is gone (deleted) is only taken off the list
  const d = clanDrop(m.clan, m.raw, target, rec && rec.clan === m.clan.id ? rec : null);
  rec || d.guards.push([userKey(target), null]);
  if (!(await casMulti(d.guards, d.ops))) throw retryAgain();
  await ulog(u.id, "clan", `클랜원 내보냄 ${target}`, { clan: m.clan.id });
  rec && (await ulog(rec.id, "clan", `클랜에서 내보내짐 [${m.clan.tag}] ${m.clan.name}`, { clan: m.clan.id }));
  return { clan: await clanView(Object.assign({}, m.clan, { members: d.rest }), c) };
};
A.clan_edit = async (q, b) => {
  const c = await loadConfig(), u = await who(b.token);
  clanOn(c);
  if (!u) throw fail(401, "다시 로그인해 주세요");
  if (u.guest) throw fail(403, "게스트는 클랜을 쓸 수 없습니다. 계정을 만들어 주세요");
  if (await limited("clanop:" + u.id, 30, 600)) throw fail(429, "너무 자주 보냈습니다");
  const m = await clanOfUser(u);
  if (!m) throw fail(409, "클랜에 들어 있지 않습니다");
  if (String(m.clan.owner).toLowerCase() !== u.id.toLowerCase()) throw fail(403, "클랜장만 할 수 있습니다");
  const desc = cleanClanDesc(b.desc);
  checkClanDesc(desc);
  const next = Object.assign({}, m.clan, { desc });
  if (!(await casMulti([[cKey(m.clan.id), m.raw]], [["SET", cKey(m.clan.id), JSON.stringify(next)]]))) throw retryAgain();
  return { clan: await clanView(next, c) };
};

// the tags beside names in a game: [[account record, the answer about it]] gets `clan` (the tag) on each answer whose account
// is in a clan that lists it. Only the server's data: a client never sends a tag.
async function clanTagsInto(pairs, c) {
  if (!c.clan.on) return;
  const ids = [...new Set(pairs.map(([r]) => r && !r.guest && clanId(r.clan)).filter(Boolean))];
  if (!ids.length) return;
  const got = (await pipe(ids.map((id) => ["GET", cKey(id)]))).map((x) => (x ? JSON.parse(x) : null));
  const by = new Map(ids.map((id, i) => [id, got[i]]));
  for (const [r, out] of pairs) {
    const cl = r && !r.guest ? by.get(clanId(r.clan)) : null;
    cl && inClan(cl, r.id) && (out.clan = cl.tag);
  }
}

// ── the all-time boards ──
// Sorted sets with the account (lower case) as the member: kills, XP (the level), wins and matches played, written by a match
// with a valid ticket (A.progress: boardsAfterMatch) as the account's own totals, so an account from before the boards
// is on them with everything it has the first time it finishes a match. A guest, a banned account and one the owner
// deleted are left out (the owner page takes them off; the list also checks). The clan board is ZINCRBY by the XP its members
// earn, plus or minus the XP of one who joins or leaves, and is set right whenever the clan is looked at. The clan board counts the
// sum of the members' XP and not their wins: a day's XP has a ceiling for each account (xp.maxPerDay), so a clan grows with
// how many play and how much, and one account cannot lift it past what it could earn in a day.
async function boardsAfterMatch(u, xpGain) {
  if (u.guest) return;
  const id = u.id.toLowerCase(), cmds = [["ZADD", BOARDS.kills, String(u.kills | 0), id], ["ZADD", BOARDS.level, String(u.xp || 0), id], ["ZADD", BOARDS.wins, String(u.wins | 0), id], ["ZADD", BOARDS.matches, String(u.matches | 0), id]];
  clanId(u.clan) && xpGain > 0 && cmds.push(["ZINCRBY", BOARDS.clan, String(xpGain), u.clan]);
  try { await pipe(cmds); } catch (e) {}
}
const BOARD_MAX = 100;
const boardCache = new Map();
const banned = (x) => !!(x.ban && (!x.ban.until || x.ban.until > now()));
async function boardTop(kind, n, c) {
  const hit = boardCache.get(kind);
  if (hit && hit.until > now() && hit.size >= n) return hit.rows.slice(0, n);
  const flat = (await redis(["ZRANGE", BOARDS[kind], "0", String(n * 2 - 1), "REV", "WITHSCORES"])) || [], ids = [], score = [];
  for (let i = 0; i < flat.length; i += 2) { ids.push(flat[i]); score.push(+flat[i + 1]); }
  let rows;
  if ("clan" === kind) {
    const recs = ids.length ? (await pipe(ids.map((id) => ["GET", cKey(id)]))).map((x) => (x ? JSON.parse(x) : null)) : [];
    const gone = ids.filter((id, i) => !recs[i]);
    if (gone.length) try { await pipe(gone.map((id) => ["ZREM", BOARDS.clan, id])); } catch (e) {}
    rows = recs.map((cl, i) => (cl ? { id: cl.id, name: cl.name, tag: cl.tag, n: cl.members.length, v: score[i] } : null)).filter(Boolean);
  } else {
    const recs = ids.length ? (await pipe(ids.map((id) => ["GET", userKey(id)]))).map((x) => (x ? JSON.parse(x) : null)) : [];
    rows = [];
    const pairs = [];
    recs.forEach((x, i) => {
      if (!x || x.guest || banned(x)) return;
      const row = { name: x.id, v: score[i] };
      "level" === kind && (row.lv = levelOf(score[i], c.xp.perLevel).level);
      rows.push(row);
      pairs.push([x, row]);
    });
    await clanTagsInto(pairs, c);
  }
  rows = rows.slice(0, n).map((r, i) => Object.assign({ pos: i + 1 }, r));
  boardCache.set(kind, { rows, size: n, until: now() + 10000 });
  return rows;
}
// where the signed-in account stands on the board, whether or not it is in the top list: { pos (null: not listed yet), v }
async function boardMe(kind, token, c) {
  let u;
  try { u = await who(token); } catch (e) { return null; }
  if (!u || u.guest) return null;
  const mem = "clan" === kind ? ((await clanOfUser(u)) || {}).clan : null;
  if ("clan" === kind && !mem) return null;
  const member = "clan" === kind ? mem.id : u.id.toLowerCase();
  const [rank, sc] = await pipe([["ZREVRANK", BOARDS[kind], member], ["ZSCORE", BOARDS[kind], member]]);
  const own = { kills: u.kills | 0, level: u.xp || 0, wins: u.wins | 0, matches: u.matches | 0 }[kind];
  const out = { name: "clan" === kind ? mem.name : u.id, pos: rank == null ? null : rank + 1, v: sc == null ? own : +sc };
  "clan" === kind ? (out.tag = mem.tag) : "level" === kind && (out.lv = levelOf(out.v, c.xp.perLevel).level);
  return out;
}
A.board = async (q, b) => {
  const kind = Object.hasOwn(BOARDS, b.kind) ? b.kind : "", c = await loadConfig();
  if (!kind) throw fail(400, "순위표를 고르세요");
  if (await limited("board:" + (requestState.getStore()?.get("requestIp") || "-"), 60, 60)) throw fail(429, "너무 자주 보냈습니다");
  const n = Math.max(1, Math.min(BOARD_MAX, Math.round(+b.n) || 50));
  if ("clan" === kind && !c.clan.on) return { kind, rows: [], me: null, off: true };
  const rows = await boardTop(kind, n, c);
  return { kind, rows, me: b.token ? await boardMe(kind, b.token, c) : null };
};

// ── the owner's side of the clans ──
// one clan with its members (the public clan_get is closed while clans are switched off)
ADMIN.clan_get = async (q, b) => {
  const { clan: cl } = await clanRead(clanId(b.id));
  if (!cl) throw fail(404, "없는 클랜입니다");
  return { clan: await clanView(cl, await loadConfig()) };
};
ADMIN.clans = async (q, b) => {
  const c = await loadConfig(), text = String(b.q == null ? "" : b.q).toLowerCase().replace(/[\s|]/g, "").slice(0, 16);
  const all = ((await redis(["ZRANGE", CLAN_INDEX, "0", "-1"])) || []).map((x) => x.split("|")).filter(([nk, tk]) => !text || nk.includes(text) || tk.includes(text));
  const page = all.slice((b.page | 0) * 50, (b.page | 0) * 50 + 50);
  const recs = page.length ? (await pipe(page.map((x) => ["GET", cKey(x[2])]))).map((x) => (x ? JSON.parse(x) : null)) : [];
  return { total: all.length, clans: recs.filter(Boolean).map((cl) => Object.assign(clanBrief(cl, c), { owner: cl.owner, at: cl.at })) };
};
// take the pointer off an account that was in the clan (the clan is gone); one that cannot be reached is cleared the next time it is read
async function clanUnlink(id, clan) {
  for (let i = 0; i < 4; i++) {
    const r = await getJ(userKey(id));
    if (!r || r.clan !== clan) return;
    outOfClan(r);
    try { await saveUser(r); return; } catch (e) { if (!e.retryUser) return; }
  }
}
ADMIN.clan_delete = async (q, b) => {
  const { clan: cl, raw } = await clanRead(clanId(b.id));
  if (!cl) throw fail(404, "없는 클랜입니다");
  const ok = await casMulti([[cKey(cl.id), raw]], [["DEL", cKey(cl.id)], ["DEL", cNameKey(nameKeyOf(cl.name))], ["DEL", cTagKey(tagKeyOf(cl.tag))], ["ZREM", CLAN_INDEX, clanIdx(cl)], ["ZREM", BOARDS.clan, cl.id]]);
  if (!ok) throw retryAgain();
  for (const m of cl.members) await clanUnlink(m.id, cl.id);
  await log("admin", `클랜 삭제: [${cl.tag}] ${cl.name}`);
  return { ok: !0 };
};
// a new name and/or tag (the shape is checked, the swear filter is not: the owner decides); each stays unique
ADMIN.clan_rename = async (q, b) => {
  const { clan: cl, raw } = await clanRead(clanId(b.id));
  if (!cl) throw fail(404, "없는 클랜입니다");
  const name = b.name == null || "" === String(b.name).trim() ? cl.name : cleanClanName(b.name), tag = b.tag == null || "" === String(b.tag).trim() ? cl.tag : cleanClanName(b.tag);
  checkClanText(name === cl.name ? undefined : name, tag === cl.tag ? undefined : tag, true);
  const next = Object.assign({}, cl, { name, tag }), guards = [[cKey(cl.id), raw]], ops = [["SET", cKey(cl.id), JSON.stringify(next)], ["ZREM", CLAN_INDEX, clanIdx(cl)], ["ZADD", CLAN_INDEX, "0", clanIdx(next)]];
  if (nameKeyOf(name) !== nameKeyOf(cl.name)) { guards.push([cNameKey(nameKeyOf(name)), null]); ops.push(["DEL", cNameKey(nameKeyOf(cl.name))], ["SET", cNameKey(nameKeyOf(name)), cl.id]); }
  if (tagKeyOf(tag) !== tagKeyOf(cl.tag)) { guards.push([cTagKey(tagKeyOf(tag)), null]); ops.push(["DEL", cTagKey(tagKeyOf(cl.tag))], ["SET", cTagKey(tagKeyOf(tag)), cl.id]); }
  if (!(await casMulti(guards, ops))) {
    const [n, t] = await pipe([["GET", cNameKey(nameKeyOf(name))], ["GET", cTagKey(tagKeyOf(tag))]]);
    if (n && n !== cl.id) throw fail(409, "이미 있는 클랜 이름입니다");
    if (t && t !== cl.id) throw fail(409, "이미 있는 클랜 태그입니다");
    throw retryAgain();
  }
  await log("admin", `클랜 이름 변경: [${cl.tag}] ${cl.name} → [${tag}] ${name}`);
  return { clan: clanBrief(next, await loadConfig()) };
};
// an account the owner bans, deletes or sets the XP of: the boards follow (and a deleted account leaves its clan)
const userSetBase = ADMIN.user_set;
ADMIN.user_set = async (q, b, req) => {
  const id = cleanId(b.id), before = ["ban", "delete", "xp", "level"].includes(b.op) ? await getJ(userKey(id)) : null;
  const out = await userSetBase(q, b, req);
  if (!before || before.guest) return out;
  const low = id.toLowerCase();
  try {
    if ("ban" === b.op || "delete" === b.op) await pipe(["kills", "level", "wins", "matches"].map((k) => ["ZREM", BOARDS[k], low]));
    if ("delete" === b.op && clanId(before.clan)) {
      const { clan: cl, raw } = await clanRead(before.clan);
      if (inClan(cl, before.id)) { const d = clanDrop(cl, raw, before.id, null, before.xp || 0); await casMulti(d.guards, d.ops); }
    } else if ("xp" === b.op || "level" === b.op) {
      const now_ = await getJ(userKey(id));
      if (now_ && !banned(now_)) {
        const cmds = [["ZADD", BOARDS.level, String(now_.xp || 0), low]];
        clanId(now_.clan) && (now_.xp || 0) !== (before.xp || 0) && cmds.push(["ZINCRBY", BOARDS.clan, String((now_.xp || 0) - (before.xp || 0)), now_.clan]);
        await pipe(cmds);
      }
    }
  } catch (e) {}
  return out;
};
// the public config tells the homepage whether clans are on and what they cost
const configBase = A.config;
A.config = async (q, b, req) => {
  const out = await configBase(q, b, req);
  out.config.clan = clanPublicCfg(await loadConfig());
  return out;
};

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
    try { await purgeRankedStep(); } catch (e) {}
    RURL && (await flushUse());
    res.statusCode = 200;
    res.end(JSON.stringify(Object.assign({ ok: !0 }, out)));
  } catch (e) {
    res.statusCode = e.code && e.code >= 400 && e.code < 600 ? e.code : 500;
    if (res.statusCode >= 500) {
      const action = new URL(req.url, 'http://localhost').searchParams.get('a') || '';
      console.warn(JSON.stringify({kind:'api-error',requestId,status:res.statusCode,action:/^[a-z_]{1,40}$/.test(action)?action:'invalid'}));
    }
    // fail() gives a status and words meant for the player; anything else (a Redis or code error) keeps its text in the log only
    const ours = "number" == typeof e.code;
    ours || console.warn(JSON.stringify({ kind: "api-exception", requestId, message: String((e && e.message) || e).slice(0, 300) }));
    res.end(JSON.stringify({ ok: !1, error: ours ? e.message || String(e) : "서버 오류가 났습니다. 잠시 후 다시 시도해 주세요", ban: e.ban || undefined, retryable: e.retryUser || undefined }));
  }
});
module.exports.DEFAULT_CONFIG = DEFAULT_CONFIG;
module.exports.CATALOG = { guns: GUNS, tiers: SKIN_TIER, only: SKIN_ONLY, items: ITEMS };
module.exports.COS = COS;
module.exports.FB_TYPES = FB_TYPES;
