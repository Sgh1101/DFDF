// Game backend: accounts (id + password, no e-mail), guests, levels, the
// public room list, bans, server logs, the owner's settings, and the owner's
// admin page. One function, `?a=<action>`. Data lives in Redis (Upstash REST,
// connected from the Vercel dashboard). The owner password is never in the
// repository: it is the ADMIN_MASTER_PASS environment variable.
const crypto = require("crypto");

const RURL = process.env.KV_REST_API_URL || process.env.UPSTASH_REDIS_REST_URL || "";
const RTOK = process.env.KV_REST_API_TOKEN || process.env.UPSTASH_REDIS_REST_TOKEN || "";
const MASTER = process.env.ADMIN_MASTER_PASS || "";
const SECRET = process.env.SESSION_SECRET || crypto.createHash("sha256").update("13|" + MASTER + "|" + RTOK).digest("hex");

// ── redis over REST ──
async function redis(cmd) {
  if (!RURL) throw Object.assign(new Error("저장소가 연결되지 않았습니다"), { code: 503 });
  const r = await fetch(RURL, { method: "POST", headers: { Authorization: "Bearer " + RTOK, "Content-Type": "application/json" }, body: JSON.stringify(cmd) });
  const j = await r.json();
  if (j.error) throw new Error(j.error);
  return j.result;
}
async function pipe(cmds) {
  if (!cmds.length) return [];
  if (!RURL) throw Object.assign(new Error("저장소가 연결되지 않았습니다"), { code: 503 });
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
  channels: [
    { id: "s1", name: "서버 1", en: "Server 1" },
    { id: "s2", name: "서버 2", en: "Server 2" },
    { id: "free", name: "자유 서버", en: "Casual" },
  ],
};
const isObj = (v) => v && "object" == typeof v && !Array.isArray(v);
function merge(base, over) {
  if (!isObj(base) || !isObj(over)) return over === undefined ? base : over;
  const out = Object.assign({}, base);
  for (const k in over) out[k] = k in base ? (isObj(base[k]) ? merge(base[k], over[k]) : typeof over[k] === typeof base[k] || Array.isArray(base[k]) ? over[k] : base[k]) : out[k];
  return out;
}
const loadConfig = async () => merge(DEFAULT_CONFIG, (await getJ("config")) || {});

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
const publicUser = (u, per) => {
  const lv = levelOf(u.xp || 0, per);
  return { id: u.id, guest: !!u.guest, xp: u.xp || 0, level: lv.level, into: lv.into, need: lv.need, kills: u.kills || 0, wins: u.wins || 0, matches: u.matches || 0, admin: !!(u.adminUntil && u.adminUntil > now()), adminUntil: u.adminUntil || 0, created: u.created };
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

// ── public actions ──
const A = {};
A.config = async () => {
  const c = await loadConfig();
  return { config: { game: c.game, cheat: c.cheat, room: c.room, xp: c.xp, channels: c.channels }, store: !!RURL };
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
  const ban = await banOf(u, b.device, ip);
  if (ban) throw Object.assign(fail(403, "이용이 제한된 계정입니다"), { ban });
  if (c.game.maintenance) throw fail(503, c.game.maintenanceMsg);
  u.lastSeen = now();
  u.lastIp = ip;
  u.dev = String(b.device || "").slice(0, 64);
  await saveUser(u);
  await log(created ? "join" : "login", (created ? "가입: " : "로그인: ") + id, { ip, user: id });
  return { token: sign({ k: "p", id, exp: now() + 30 * 864e5 }), user: publicUser(u, c.xp.perLevel), created };
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
  const ban = await banOf(u, dev, ip);
  if (ban) throw Object.assign(fail(403, "이용이 제한되었습니다"), { ban });
  u.lastSeen = now();
  u.lastIp = ip;
  await saveUser(u);
  await log("guest", "게스트 입장: " + u.id, { ip, user: u.id });
  return { token: sign({ k: "p", id: dev, g: 1, exp: now() + 30 * 864e5 }), user: publicUser(u, c.xp.perLevel) };
};
A.me = async (q, b, req) => {
  const c = await loadConfig(),
    u = await who(b.token || q.token);
  if (!u) throw fail(401, "다시 로그인해 주세요");
  const ban = await banOf(u, u.dev, ipOf(req));
  if (ban) throw Object.assign(fail(403, "이용이 제한되었습니다"), { ban });
  return { user: publicUser(u, c.xp.perLevel) };
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
  u.xp = (u.xp || 0) + gain;
  u.kills = (u.kills || 0) + kills;
  u.wins = (u.wins || 0) + (win ? 1 : 0);
  u.matches = (u.matches || 0) + 1;
  await saveUser(u);
  const p = publicUser(u, c.xp.perLevel);
  p.level > before && (await log("level", `${u.id} 레벨 ${p.level}`, { user: u.id }));
  return { gain, user: p, levelUp: p.level > before };
};
// the room list (rooms report themselves every few seconds while open)
const ROOM_TTL = 45;
A.rooms = async () => {
  const c = await loadConfig();
  if (!c.game.roomListOpen) return { rooms: [] };
  await redis(["ZREMRANGEBYSCORE", "rooms", "-inf", String(now() - ROOM_TTL * 1000)]);
  const codes = await redis(["ZRANGE", "rooms", "0", "199"]);
  const rows = await pipe(codes.map((k) => ["GET", "room:" + k]));
  return { rooms: rows.filter(Boolean).map((r) => JSON.parse(r)).filter((r) => !r.private).map(({ code, name, ch, mode, map, players, max, state, host, created }) => ({ code, name, ch, mode, map, n: (players || []).length, max, state, host, created })) };
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
  };
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
  if (players.length) {
    const recs = await pipe(players.map((p) => ["GET", userKey(p)]));
    recs.forEach((r, i) => {
      if (!r) return;
      const x = JSON.parse(r);
      x.ban && (!x.ban.until || x.ban.until > now()) && banned.push(players[i]);
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
  return { users, rooms, logs, newToday: recent, bans: (devBans || []).length + (ipBans || []).length };
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
      return Object.assign(publicUser(u, c.xp.perLevel), { lastSeen: u.lastSeen, lastIp: u.lastIp, dev: u.dev, ban: u.ban || null, note: u.note || "" });
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
      u.adminUntil = b.days > 0 ? Math.max(now(), u.adminUntil || 0) + b.days * 864e5 : 0;
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
  await log("admin", `계정 ${id}: ${b.op}${b.days ? " " + b.days + "일" : ""}${b.reason ? " (" + b.reason + ")" : ""}`);
  return { ok: !0 };
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
  const ok = ["kick", "move", "msg", "close", "settings", "cheat"];
  if (!ok.includes(b.cmd)) throw fail(400, "알 수 없는 명령");
  const cmd = { cmd: b.cmd, name: b.name ? String(b.name).slice(0, 20) : undefined, team: b.team, text: b.text ? String(b.text).slice(0, 200) : undefined, set: isObj(b.set) ? b.set : undefined, at: now() };
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
  await log("admin", "설정 저장");
  return { config: c };
};
ADMIN.config_reset = async () => {
  await redis(["DEL", "config"]);
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
    res.statusCode = 200;
    res.end(JSON.stringify(Object.assign({ ok: !0 }, out)));
  } catch (e) {
    res.statusCode = e.code && e.code >= 400 && e.code < 600 ? e.code : 500;
    res.end(JSON.stringify({ ok: !1, error: e.message || String(e), ban: e.ban || undefined }));
  }
};
module.exports.DEFAULT_CONFIG = DEFAULT_CONFIG;
