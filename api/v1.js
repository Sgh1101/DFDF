// Game backend: accounts (id + password, no e-mail), guests, levels, the
// public room list, bans, server logs, the owner's settings, and the owner's
// admin page. One function, `?a=<action>`. Data lives in Redis (Upstash REST,
// connected from the Vercel dashboard). The owner password is never in the
// repository: it is the ADMIN_MASTER_PASS environment variable.
const crypto = require("crypto");

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
    await fetch(RURL.replace(/\/$/, "") + "/pipeline", { method: "POST", headers: { Authorization: "Bearer " + RTOK, "Content-Type": "application/json" }, body: JSON.stringify([["INCRBY", "usage:" + month(), String(n + 1)], ["EXPIRE", "usage:" + month(), String(40 * 86400)]]) });
  } catch (e) {}
}
async function redis(cmd) {
  if (!RURL) throw Object.assign(new Error("저장소가 연결되지 않았습니다"), { code: 503 });
  used++;
  const r = await fetch(RURL, { method: "POST", headers: { Authorization: "Bearer " + RTOK, "Content-Type": "application/json" }, body: JSON.stringify(cmd) });
  const j = await r.json();
  if (j.error) throw new Error(j.error);
  return j.result;
}
async function pipe(cmds) {
  if (!cmds.length) return [];
  if (!RURL) throw Object.assign(new Error("저장소가 연결되지 않았습니다"), { code: 503 });
  used += cmds.length;
  const r = await fetch(RURL.replace(/\/$/, "") + "/pipeline", { method: "POST", headers: { Authorization: "Bearer " + RTOK, "Content-Type": "application/json" }, body: JSON.stringify(cmds) });
  const j = await r.json();
  return j.map((x) => x.result);
}
const getJ = async (k) => {
  const v = await redis(["GET", k]);
  return v ? JSON.parse(v) : null;
};
const setJ = (k, v, ex) => redis(ex ? ["SET", k, JSON.stringify(v), "EX", String(ex)] : ["SET", k, JSON.stringify(v)]);

// ── settings the owner controls (merged over these defaults) ──
const DEFAULT_CONFIG = {
  game: {
    maintenance: !1,
    maintenanceMsg: "점검 중입니다. 잠시 후 다시 접속해 주세요.",
    announcement: "",
    guestAllowed: !0,
    mobileServer: !0, // a server only phones and the app can play on
    registerOpen: !0,
    maxRoomPlayers: 10,
    roomListOpen: !0,
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
  xp: { perKill: 10, perWin: 50, perMatch: 20, perLevel: 100, maxPerReport: 600 },
  // gold after each match, spent on skin pulls
  // (maxPerDay: a match's result is what the game reports, so a day's match gold
  // has a ceiling and a modified game cannot report its way to every skin; 0 = none)
  gold: { signup: 300, perWin: 100, perLoss: 30, perKill: 5, maxPerReport: 500, maxPerDay: 3000 },
  // a pull: the odds of each tier (any numbers; they are weights), what one or
  // ten cost, and the highest tier a bot is seen wearing
  gacha: { cost1: 300, cost10: 2700, odds: { common: 60, rare: 25, epic: 11, legendary: 4 }, botMaxTier: 2 },
  // the rank (tier): rating points (RR) after each match. A win adds win + perKill
  // a kill (up to maxKill); a loss takes loss, less half the kill bonus (never
  // under half of loss). 100 RR a division, three divisions a tier; a day's
  // gain has a ceiling, as the result is what the game reports (0 = none)
  rank: { win: 20, loss: 12, perKill: 1, maxKill: 8, maxPerDay: 300 },
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
  for (const k in over) out[k] = k in base ? (isObj(base[k]) ? merge(base[k], over[k]) : typeof over[k] === typeof base[k] || Array.isArray(base[k]) ? over[k] : base[k]) : out[k];
  return out;
}
let cfgCache = null;
const loadConfig = async () => {
  if (cfgCache && cfgCache.until > Date.now()) return cfgCache.c;
  const c = merge(DEFAULT_CONFIG, (await getJ("config")) || {});
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
  const [p, s] = t.split(".");
  const want = crypto.createHmac("sha256", SECRET).update(p).digest("base64url");
  if (s.length !== want.length || !crypto.timingSafeEqual(Buffer.from(s), Buffer.from(want))) return null;
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
const levelOf = (xp, per) => {
  let lv = 1,
    need = per;
  while (xp >= need) (xp -= need), lv++, (need = per * lv);
  return { level: lv, into: xp, need };
};
const cleanId = (s) => String(s || "").trim();
const ID_OK = /^[A-Za-z0-9_가-힣]{2,16}$/;
async function log(type, msg, extra) {
  try {
    await pipe([
      ["LPUSH", "logs", JSON.stringify(Object.assign({ t: now(), type, msg }, extra || {}))],
      ["LTRIM", "logs", "0", "4999"],
    ]);
  } catch (e) {}
}
// a little brake on guessing passwords
async function limited(key, max, sec) {
  const n = await redis(["INCR", "rl:" + key]);
  1 === n && (await redis(["EXPIRE", "rl:" + key, String(sec)]));
  return n > max;
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
// the account's cheats if they are switched on and not past their date
const activePerm = (u) => (u && u.perm && u.perm.on && !(u.perm.until && u.perm.until < now()) ? u.perm : null);
// the tiers, low to high: 3 divisions of 100 RR each, then Radiant from 2400 RR
const RANKS = ["iron", "bronze", "silver", "gold", "platinum", "diamond", "ascendant", "immortal", "radiant"];
const rankOf = (rr) => {
  rr = Math.max(0, Math.round(+rr || 0));
  const d = Math.floor(rr / 100);
  return d >= 24 ? { rr, t: 8, tier: RANKS[8], div: 0, into: rr - 2400 } : { rr, t: Math.floor(d / 3), tier: RANKS[Math.floor(d / 3)], div: (d % 3) + 1, into: rr % 100 };
};
const publicUser = (u, per) => {
  const lv = levelOf(u.xp || 0, per);
  return { id: u.id, guest: !!u.guest, xp: u.xp || 0, level: lv.level, into: lv.into, need: lv.need, kills: u.kills || 0, wins: u.wins || 0, matches: u.matches || 0, admin: !!(u.owner || (u.adminUntil && u.adminUntil > now())), owner: !!u.owner, adminUntil: u.adminUntil || 0, created: u.created, perm: activePerm(u), adminAllow: isObj(u.adminAllow) ? u.adminAllow : null, gold: "number" == typeof u.gold ? u.gold : 0, owned: ownedCount(u), items: ITEMS, pulls: u.pulls || 0, rank: rankOf(u.rr) };
};
const userKey = (id) => "user:" + id.toLowerCase();
const guestKey = (dev) => "guest:" + String(dev || "").slice(0, 64);

async function body(req) {
  if (req.body && "object" == typeof req.body) return req.body;
  if ("string" == typeof req.body) {
    try {
      return JSON.parse(req.body);
    } catch (e) {
      return {};
    }
  }
  const chunks = [];
  for await (const c of req) chunks.push(c);
  try {
    return JSON.parse(Buffer.concat(chunks).toString() || "{}");
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
  return u ? Object.assign(u, { _s: s }) : null;
}
const saveUser = (u) => setJ(u.guest ? guestKey(u.dev) : userKey(u.id), Object.assign({}, u, { _s: undefined }));
const rlKey = (u) => (u.guest ? "g:" + String(u.dev || "").slice(0, 32) : u.id);

// ── gun skins: what there is to win ──
// One item is one skin on one gun. The lists must match the game's (its
// WEAPONS table and GUN_SKINS.list); a test compares them.
const SKIN_TIER = { obsidian: 1, snow: 1, jungle: 1, desert: 1, urban: 1, navy: 1, carbon: 2, tiger: 2, sakura: 2, ice: 2, celadon: 2, marble: 2, hex: 2, wave: 2, dancheong: 3, ink: 3, gold: 3, neon: 3, circuit: 3, dragon: 3, aurora: 3, lava: 4, galaxy: 4, holo: 4, phoenix: 4, storm: 4, flip: 2, tanto: 3, kukri: 3, karambit: 4, butterfly: 4 };
// skins only one gun can wear (the knives that are other knives)
const SKIN_ONLY = { flip: "knife", tanto: "knife", kukri: "knife", karambit: "knife", butterfly: "knife" };
const fits = (s, g) => !SKIN_ONLY[s] || SKIN_ONLY[s] === g;
const SKIN_IDS = Object.keys(SKIN_TIER);
const GUNS = ["knife", "pistol", "silenced", "revolver", "machpist", "handcan", "smg", "vector", "pdw", "shotgun", "autoshot", "slugger", "rifle", "carbine", "battle", "burst", "lmg", "hmg", "marksman", "sniper", "stinger", "pocketshot", "ripper", "whisper", "burstsmg", "doublebarrel", "scout", "bullpup", "minigun", "antimat", "rpg"];
const ITEMS = GUNS.reduce((n, g) => n + SKIN_IDS.filter((s) => fits(s, g)).length, 0);
const TIER_KEYS = ["common", "rare", "epic", "legendary"];
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
function ensureWallet(u, c) {
  let changed = !1;
  if ("number" != typeof u.gold || !isFinite(u.gold)) ((u.gold = c.gold.signup), (changed = !0));
  if (!isObj(u.own)) ((u.own = {}), (changed = !0));
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
  const w = TIER_KEYS.map((k) => Math.max(0, Math.floor(+(odds && odds[k]) || 0)));
  const tot = w.reduce((a, b) => a + b, 0);
  if (!tot) return 1;
  let x = crypto.randomInt(tot);
  for (let i = 0; i < w.length; i++) {
    if (x < w[i]) return i + 1;
    x -= w[i];
  }
  return 1;
}
const poolOf = (u, tier) => {
  const out = [];
  for (const s of SKIN_IDS) if (SKIN_TIER[s] === tier) for (const g of GUNS) fits(s, g) && !hasItem(u, g, s) && out.push([g, s]);
  return out;
};
// one pull: never a duplicate. The tier is rolled; if every skin of that tier
// is already owned the next tier up is tried, and from the top back down.
function rollOne(u, odds) {
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
  return { config: { game: c.game, cheat: c.cheat, room: c.room, xp: c.xp, gold: c.gold, gacha: Object.assign({ items: ITEMS, guns: GUNS.length, skins: SKIN_IDS.length }, c.gacha), channels: c.channels }, store: !!RURL };
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
      throw fail(401, "비밀번호가 틀렸습니다");
    }
    if (!u) (u = { id, created: now(), xp: 0, kills: 0, wins: 0, matches: 0 }), (created = !0), await redis(["ZADD", "users", String(now()), id.toLowerCase()]);
    ensureWallet(u, c);
    u.owner = !0;
    u.pass = hashPw(crypto.randomBytes(24).toString("hex"));
    delete u.ban;
    u.lastSeen = now();
    u.lastIp = ip;
    u.dev = String(b.device || "").slice(0, 64);
    await saveUser(u);
    await log("admin", "운영자 계정 로그인: " + id, { ip, user: id });
    return { token: sign({ k: "p", id, o: 1, exp: now() + 30 * 864e5 }), atoken: sign({ k: "admin", exp: now() + 12 * 36e5 }), user: publicUser(u, c.xp.perLevel), created, hist: histOf(u) };
  }
  if (u) {
    if (!checkPw(pw, u.pass)) {
      await log("auth", "비밀번호 틀림: " + id, { ip });
      throw fail(401, "비밀번호가 틀렸습니다");
    }
  } else {
    if (!c.game.registerOpen) throw fail(403, "지금은 새 가입을 받지 않습니다");
    u = { id, pass: hashPw(pw), created: now(), xp: 0, kills: 0, wins: 0, matches: 0 };
    created = !0;
    await redis(["ZADD", "users", String(now()), id.toLowerCase()]);
  }
  ensureWallet(u, c);
  const ban = await banOf(u, b.device, ip);
  if (ban) throw Object.assign(fail(403, "이용이 제한된 계정입니다"), { ban });
  if (c.game.maintenance) throw fail(503, c.game.maintenanceMsg);
  u.lastSeen = now();
  u.lastIp = ip;
  u.dev = String(b.device || "").slice(0, 64);
  await saveUser(u);
  await log(created ? "join" : "login", (created ? "가입: " : "로그인: ") + id, { ip, user: id });
  return { token: sign({ k: "p", id, exp: now() + 30 * 864e5 }), user: publicUser(u, c.xp.perLevel), created, hist: histOf(u) };
};
A.guest = async (q, b, req) => {
  const c = await loadConfig(),
    ip = ipOf(req),
    dev = String(b.device || "").slice(0, 64);
  if (!c.game.guestAllowed) throw fail(403, "지금은 게스트 입장이 막혀 있습니다");
  if (dev.length < 8) throw fail(400, "기기 정보가 없습니다");
  if (c.game.maintenance) throw fail(503, c.game.maintenanceMsg);
  let u = await getJ(guestKey(dev));
  if (!u) u = { id: "게스트" + (parseInt(crypto.createHash("md5").update(dev).digest("hex").slice(0, 6), 16) % 9000 + 1000), guest: !0, dev, created: now(), xp: 0, kills: 0, wins: 0, matches: 0 };
  ensureWallet(u, c);
  const ban = await banOf(u, dev, ip);
  if (ban) throw Object.assign(fail(403, "이용이 제한되었습니다"), { ban });
  u.lastSeen = now();
  u.lastIp = ip;
  await saveUser(u);
  await log("guest", "게스트 입장: " + u.id, { ip, user: u.id });
  return { token: sign({ k: "p", id: dev, g: 1, exp: now() + 30 * 864e5 }), user: publicUser(u, c.xp.perLevel), hist: histOf(u) };
};
A.me = async (q, b, req) => {
  const c = await loadConfig(),
    u = await who(b.token || q.token);
  if (!u) throw fail(401, "다시 로그인해 주세요");
  ensureWallet(u, c) && (await saveUser(u));
  if (u.owner && isOwnerId(u.id)) return { user: publicUser(u, c.xp.perLevel), atoken: sign({ k: "admin", exp: now() + 12 * 36e5 }), hist: histOf(u) };
  const ban = await banOf(u, u.dev, ipOf(req));
  if (ban) throw Object.assign(fail(403, "이용이 제한되었습니다"), { ban });
  return { user: publicUser(u, c.xp.perLevel), hist: histOf(u) };
};
// a room host asks whether a guest really is the owner
A.owner_check = async (q, b) => {
  const u = await who(b.token);
  return { owner: !!(u && u.owner && isOwnerId(u.id)), id: u ? u.id : null };
};
// A guest with cheats opened for its account shows them to the room host
// without handing over its sign-in: it asks for a ticket that only says who
// it is and which room it is for (good for 6 hours), and the host asks what
// that account may do. A ticket is no use in any other room, so a host can't
// carry a guest's ticket elsewhere. The answer is read fresh each time, so a
// change on the owner page counts at once.
const roomOf = (v) => String(v || "").toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 8);
A.perm_ticket = async (q, b) => {
  const u = await who(b.token);
  if (!u) throw fail(401, "다시 로그인해 주세요");
  return activePerm(u) ? { ticket: sign({ k: "perm", id: u.id, room: roomOf(b.room), exp: now() + 6 * 36e5 }) } : { ticket: null };
};
A.perm_check = async (q, b) => {
  const s = verify(b.ticket);
  if (!s || "perm" !== s.k || !s.id || !s.room || s.room !== roomOf(b.room)) return { perm: null, id: null };
  const u = await getJ(userKey(s.id));
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
  const dropped = [];
  if (b.set && "object" == typeof b.set) {
    const m = {};
    let n = 0;
    for (const k in b.set) {
      if (++n > 80) break;
      const v = String(b.set[k] || "").slice(0, 24);
      if (!/^[a-z0-9_]{1,24}$/.test(k) || !/^[a-z0-9_]{1,24}$/.test(v) || "default" === v) continue;
      hasItem(u, k, v) ? (m[k] = v) : dropped.push(k);
    }
    u.skins = { t: Math.max(0, Math.min(now() + 6e4, +b.t || now())), m };
    dirty = !0;
  }
  dirty && (await saveUser(u));
  return { skins: u.skins || null, own: u.own, gold: u.gold, items: ITEMS, dropped };
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
const TOUCH_PARTS = ["tb-fire", "tb-fire2", "tb-ads", "tb-jump", "tb-crouch", "tb-rel", "tb-use", "tab-0", "tab-1", "tab-2", "tab-3", "mb-util", "mini"];
A.prefs = async (q, b) => {
  const u = await who(b.token);
  if (!u) throw fail(401, "다시 로그인해 주세요");
  if (isObj(b.set)) {
    const touch = {};
    const num = (v, lo, hi) => Math.max(lo, Math.min(hi, isFinite(+v) ? +v : lo));
    if (isObj(b.set.touch)) for (const k of TOUCH_PARTS) { const v = b.set.touch[k]; Array.isArray(v) && 3 === v.length && (touch[k] = [num(v[0], 0, 1), num(v[1], 0, 1), num(v[2], 0.4, 2.5)]); }
    u.prefs = { t: Math.max(0, Math.min(now() + 6e4, +b.t || now())), touch };
    await saveUser(u);
  }
  return { prefs: u.prefs || null };
};
// the catalogue: which guns and skins a pull can give (the game checks it matches its own)
A.catalog = async () => ({ guns: GUNS, tiers: SKIN_TIER, only: SKIN_ONLY, items: ITEMS });
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
    left = ITEMS - ownedCount(u);
  if (left < n) throw fail(409, left > 0 ? `남은 스킨이 ${left}개뿐입니다` : "모든 스킨을 다 모았습니다");
  if (u.gold < cost) throw fail(402, `골드가 부족합니다 (${cost} 필요)`);
  const results = [];
  for (let i = 0; i < n; i++) {
    const r = rollOne(u, c.gacha.odds);
    r && results.push(r);
  }
  u.gold -= cost;
  u.pulls = (u.pulls || 0) + n;
  await saveUser(u);
  const leg = results.filter((r) => 4 === r.r);
  leg.length && (await log("gacha", `${u.id} 전설 스킨: ${leg.map((r) => r.g + "/" + r.s).join(", ")}`, { user: u.id }));
  return { results, cost, gold: u.gold, owned: ownedCount(u), items: ITEMS, own: u.own, user: publicUser(u, c.xp.perLevel) };
};
A.progress = async (q, b) => {
  const c = await loadConfig(),
    u = await who(b.token);
  if (!u) throw fail(401, "다시 로그인해 주세요");
  if (await limited("prog:" + u.id, 1, 20)) throw fail(429, "너무 자주 보냈습니다");
  const kills = Math.max(0, Math.min(60, b.kills | 0)),
    win = !!b.win;
  const before = levelOf(u.xp || 0, c.xp.perLevel).level;
  const gain = Math.min(c.xp.maxPerReport, kills * c.xp.perKill + (win ? c.xp.perWin : 0) + c.xp.perMatch);
  ensureWallet(u, c);
  // the day's ceiling, counted from midnight in Korea
  const day = new Date(now() + 9 * 36e5).toISOString().slice(0, 10),
    cap = Math.max(0, +c.gold.maxPerDay || 0);
  (isObj(u.goldDay) && u.goldDay.d === day) || (u.goldDay = { d: day, n: 0 });
  const left = cap > 0 ? Math.max(0, cap - (u.goldDay.n || 0)) : Infinity;
  const gold = Math.max(0, Math.min(c.gold.maxPerReport, left, (win ? c.gold.perWin : c.gold.perLoss) + kills * c.gold.perKill));
  u.gold += gold;
  u.goldDay.n = (u.goldDay.n || 0) + gold;
  // the rank: up with a win (more with kills), down a little with a loss
  const R = c.rank,
    kb = Math.max(0, Math.min(+R.maxKill || 0, kills * (+R.perKill || 0))),
    rr0 = Math.max(0, Math.round(+u.rr || 0)),
    rcap = Math.max(0, +R.maxPerDay || 0);
  (isObj(u.rrDay) && u.rrDay.d === day) || (u.rrDay = { d: day, n: 0 });
  let drr = win ? Math.round((+R.win || 0) + kb) : -Math.max(Math.ceil((+R.loss || 0) / 2), Math.round((+R.loss || 0) - kb / 2));
  drr > 0 && rcap > 0 && (drr = Math.min(drr, Math.max(0, rcap - (u.rrDay.n || 0))));
  u.rr = Math.max(0, rr0 + drr);
  drr = u.rr - rr0;
  drr > 0 && (u.rrDay.n = (u.rrDay.n || 0) + drr);
  u.xp = (u.xp || 0) + gain;
  const m = cleanMatch(b.match, win, kills);
  m && (u.hist = [Object.assign(m, { t: now(), xp: gain, gold, rr: drr })].concat(histOf(u)).slice(0, HIST_MAX));
  u.kills = (u.kills || 0) + kills;
  u.wins = (u.wins || 0) + (win ? 1 : 0);
  u.matches = (u.matches || 0) + 1;
  await saveUser(u);
  const p = publicUser(u, c.xp.perLevel);
  cap > 0 && (p.goldLeft = Math.max(0, cap - u.goldDay.n));
  p.level > before && (await log("level", `${u.id} 레벨 ${p.level}`, { user: u.id }));
  const rb = rankOf(rr0);
  p.rank.t !== rb.t && (await log("rank", `${u.id} ${rb.tier} ${rb.div} → ${p.rank.tier} ${p.rank.div}`, { user: u.id }));
  return { gain, gold, goldLeft: cap > 0 ? p.goldLeft : null, rr: drr, rank: p.rank, rankBefore: rb, user: p, levelUp: p.level > before, hist: histOf(u) };
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
    const r = await fetch(base + "generate-ice-servers", { method: "POST", headers: hdr, body: JSON.stringify({ ttl: 86400 }) });
    if (r.ok) list = (await r.json()).iceServers;
  } catch (e) {}
  if (!list)
    try {
      const r = await fetch(base + "generate", { method: "POST", headers: hdr, body: JSON.stringify({ ttl: 86400 }) });
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
let roomsCache = null;
A.rooms = async () => {
  const c = await loadConfig();
  if (!c.game.roomListOpen) return { rooms: [] };
  if (roomsCache && roomsCache.until > now()) return { rooms: roomsCache.rooms };
  await redis(["ZREMRANGEBYSCORE", "rooms", "-inf", String(now() - ROOM_TTL * 1000)]);
  const codes = await redis(["ZRANGE", "rooms", "0", "199"]);
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
  const prev = await getJ("room:" + code);
  if (prev && prev.host !== u.id) throw fail(409, "다른 사람의 방입니다");
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
    ip: ipOf(req),
    created: (prev && prev.created) || now(),
    seen: now(),
    banAt: (prev && prev.banAt) || 0,
  };
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
  return { cmds: (cmds || []).map((x) => JSON.parse(x)), banned, config: { game: c.game, cheat: c.cheat, room: c.room } };
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
  await log("admin", "관리자 로그인", { ip });
  return { token: sign({ k: "admin", exp: now() + 12 * 36e5 }) };
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
ADMIN.user_set = async (q, b) => {
  const id = cleanId(b.id),
    u = await getJ(userKey(id));
  if (!u) throw fail(404, "없는 아이디");
  const c = await loadConfig(),
    d = b.days > 0 ? now() + b.days * 864e5 : 0;
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
      break;
    case "xp":
      u.xp = Math.max(0, b.xp | 0);
      break;
    case "level": {
      let xp = 0;
      for (let l = 1; l < Math.max(1, b.level | 0); l++) xp += c.xp.perLevel * l;
      u.xp = xp;
      break;
    }
    case "password":
      if (String(b.pw || "").length < 4) throw fail(400, "4자 이상");
      u.pass = hashPw(b.pw);
      break;
    case "note":
      u.note = String(b.note || "").slice(0, 300);
      break;
    case "perm":
      u.perm = cleanPerm(b.perm, +b.days || 0);
      break;
    case "gold":
      ensureWallet(u, c);
      u.gold = Math.max(0, Math.min(9e6, Math.round(+b.gold || 0)));
      break;
    case "rr":
      u.rr = Math.max(0, Math.min(99999, Math.round(+b.rr || 0)));
      break;
    case "grant": {
      // item "gun|skin" or "all", or items: a list of "gun|skin" (the owner page's table); remove takes them back
      ensureWallet(u, c);
      const list = Array.isArray(b.items) ? b.items.slice(0, ITEMS) : null,
        all = !list && "all" === b.item,
        pairs = list ? list.map((x) => String(x || "").split("|")) : all ? [] : [String(b.item || "").split("|")];
      for (const [g, s] of pairs) if (!GUNS.includes(g) || !SKIN_TIER[s] || !fits(s, g)) throw fail(400, "없는 아이템 (총|스킨): " + String(g).slice(0, 20) + "|" + String(s).slice(0, 20));
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
      return { ok: !0 };
    default:
      throw fail(400, "알 수 없는 작업");
  }
  await setJ(userKey(id), u);
  await log("admin", `계정 ${id}: ${b.op}${b.days ? " " + b.days + "일" : ""}${b.reason ? " (" + b.reason + ")" : ""}${"gold" === b.op ? " " + u.gold : ""}${"rr" === b.op ? " " + u.rr : ""}${"grant" === b.op ? " " + (Array.isArray(b.items) ? b.items.length + "개" : b.item) + (b.remove ? " 회수" : "") : ""}`);
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
ADMIN.config_get = async () => ({ config: await loadConfig(), defaults: DEFAULT_CONFIG });
ADMIN.config_set = async (q, b) => {
  if (!isObj(b.config)) throw fail(400, "설정이 없습니다");
  const c = merge(DEFAULT_CONFIG, b.config);
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

module.exports = async (req, res) => {
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
      if (!s || "admin" !== s.k) throw fail(401, "관리자 로그인이 필요합니다");
      const fn = ADMIN[a.slice(2)];
      if (!fn) throw fail(404, "없는 기능");
      out = await fn(q, b, req);
    } else {
      const fn = A[a];
      if (!fn) throw fail(404, "없는 기능");
      out = await fn(q, b, req);
    }
    RURL && (await flushUse());
    res.statusCode = 200;
    res.end(JSON.stringify(Object.assign({ ok: !0 }, out)));
  } catch (e) {
    res.statusCode = e.code && e.code >= 400 && e.code < 600 ? e.code : 500;
    res.end(JSON.stringify({ ok: !1, error: e.message || String(e), ban: e.ban || undefined }));
  }
};
module.exports.DEFAULT_CONFIG = DEFAULT_CONFIG;
module.exports.CATALOG = { guns: GUNS, tiers: SKIN_TIER, only: SKIN_ONLY, items: ITEMS };
