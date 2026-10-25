const fs = require("node:fs");
const vm = require("node:vm");
const crypto = require("node:crypto");

function harness(options = {}) {
  const db = new Map(), expires = new Map();
  let clock = options.now || Date.UTC(2026, 9, 13), commitFailure = false, pipelineFailure = false;
  class Clock extends Date { constructor(...args) { super(...(args.length ? args : [clock])); } static now() { return clock; } }
  const get = (key) => {
    if (expires.has(key) && expires.get(key) <= clock) { db.delete(key); expires.delete(key); }
    return db.get(key) ?? null;
  };
  // real sorted sets for the season boards ("lb:*") and the room list; the other keys keep their old stand-ins
  const zsets = new Map();
  function zcommand(op, key, args) {
    const z = zsets.get(key) || new Map();
    zsets.set(key, z);
    switch (op) {
      case "ZADD": z.set(args[1], +args[0]); return 1;
      case "ZREM": return +z.delete(args[0]);
      case "ZCARD": return z.size;
      case "ZREMRANGEBYSCORE": { let n = 0; for (const [m, sc] of z) if (sc >= (args[0] === "-inf" ? -Infinity : +args[0]) && sc <= +args[1]) { z.delete(m); n++; } return n; }
      case "ZRANGE": {
        const rows = [...z].sort((p, q) => p[1] - q[1] || (p[0] < q[0] ? -1 : 1));
        args.includes("REV") && rows.reverse();
        const hi = +args[1] < 0 ? rows.length + +args[1] : +args[1];
        return rows.slice(+args[0], hi + 1).flatMap(([m, sc]) => (args.includes("WITHSCORES") ? [m, String(sc)] : [m]));
      }
    }
  }
  function command(cmd) {
    if (options.redisCommand) return options.redisCommand(cmd);
    const [op, key, ...args] = cmd;
    if (/^(lb:|rooms$)/.test(key) && ["ZADD", "ZREM", "ZCARD", "ZRANGE", "ZREMRANGEBYSCORE"].includes(op)) return zcommand(op, key, args);
    if (/^lb:/.test(key) && op === "EXPIRE") return 1;
    switch (op) {
      case "GET": return get(key);
      case "MGET": return [key, ...args].map(get);
      case "ZCARD": case "ZCOUNT": return key === "users" ? [...db.keys()].filter((x) => x.startsWith("user:")).length : 0;
      case "LLEN": return (db.get(key) || []).length;
      case "KEYS": { const re = new RegExp("^" + key.replace(/[.+?^${}()|[\]\\]/g, "\\$&").replace(/\*/g, ".*") + "$"); return [...db.keys()].filter((x) => re.test(x)); }
      case "SET": {
        // SET key value [NX] [EX seconds], in any order; a plain SET drops the old expiry like real Redis
        const [value, ...opts] = args;
        let nx = false, ex = 0;
        for (let i = 0; i < opts.length; i++) { const o = String(opts[i]).toUpperCase(); if (o === "NX") nx = true; else if (o === "EX") ex = +opts[++i]; else throw new Error("unsupported SET option: " + o); }
        if (nx && get(key) != null) return null;
        db.set(key, value);
        ex ? expires.set(key, clock + ex * 1000) : expires.delete(key);
        return "OK";
      }
      case "INCR": case "INCRBY": { const n = +(get(key) || 0) + (op === "INCR" ? 1 : +args[0]); db.set(key, String(n)); return n; }
      case "EXPIRE": expires.set(key, clock + +args[0] * 1000); return 1;
      case "DEL": { const had = db.delete(key); expires.delete(key); return +had; }
      case "EVAL": {
        // the per-order lock release: delete the key only while it still holds our nonce
        if (args[0] === "1" && key.includes("redis.call('GET', KEYS[1]) == ARGV[1]")) { const [lockKey, nonce] = args.slice(1); return get(lockKey) === nonce ? command(["DEL", lockKey]) : 0; }
        if (commitFailure) { commitFailure = false; throw new Error("commit unavailable"); }
        const [count, userKey, ticketKey, receiptKey, before, value, owner, receipt] = args;
        if (+count !== 3 || !key.includes("redis.call('GET', KEYS[1])")) throw new Error("unexpected script");
        if ((get(userKey) || "") !== before) return 0;
        if (ticketKey && get(ticketKey) !== owner) return -1;
        db.set(userKey, value);
        if (ticketKey) { db.delete(ticketKey); db.set(receiptKey, receipt); expires.set(receiptKey, clock + 2592000000); }
        return 1;
      }
      case "ZADD": case "ZREM": case "ZREMRANGEBYSCORE": return 1;
      case "LPUSH": case "RPUSH": { const list = db.get(key) || []; op === "LPUSH" ? list.unshift(args[0]) : list.push(args[0]); db.set(key, list); return list.length; }
      case "LTRIM": return "OK";
      case "LREM": { db.set(key, (db.get(key) || []).filter((x) => x !== args[1])); return 1; }
      case "ZRANGE": return [...db.keys()].filter((x) => x.startsWith("user:")).map((x) => x.slice(5));
      case "LRANGE": return db.get(key) || [];
      default: throw new Error("unsupported redis command: " + op);
    }
  }
  const sandbox = {
    require: (name) => name === "crypto" && options.randomBytes ? { ...crypto, randomBytes: options.randomBytes } : require(name), module: { exports: {} }, Buffer, Date: Clock, AbortController, setTimeout, clearTimeout,
    process: { env: { KV_REST_API_URL: "https://redis.test", KV_REST_API_TOKEN: "test", ADMIN_MASTER_PASS: "owner-password", OWNER_ID: "owner", SESSION_SECRET: "test-secret" } },
    fetch: async (url, options) => {
      // Yield before execution, so parallel calls read overlapping snapshots.
      await new Promise((resolve) => setImmediate(resolve));
      const cmds = JSON.parse(options.body);
      const piped = url.endsWith("/pipeline");
      const result = piped ? cmds.map((x) => pipelineFailure ? { error: "pipeline failed" } : { result: command(x) }) : { result: command(cmds) };
      return { ok: true, json: async () => result };
    }, URL, console,
  };
  vm.runInNewContext(fs.readFileSync("api/v1.js", "utf8"), sandbox, { filename: "api/v1.js" });
  async function api(action, body = {}, headers = {}) {
    let response;
    const res = { setHeader() {}, statusCode: 0, end(value) { response = { status: this.statusCode, ...JSON.parse(value) }; } };
    await sandbox.module.exports({ method: "POST", url: "/api/v1?a=" + action, body, headers: { "x-forwarded-for": "127.0.0.1", ...headers } }, res);
    return response;
  }
  const sign = (value) => { const p = Buffer.from(JSON.stringify(value)).toString("base64url"); return p + "." + crypto.createHmac("sha256", "test-secret").update(p).digest("base64url"); };
  return { api, db, sign, advance: (ms) => clock += ms, now: () => clock, failCommit: () => commitFailure = true, failPipeline: () => pipelineFailure = true, user: (id) => JSON.parse(db.get("user:" + id)), config: sandbox.module.exports.DEFAULT_CONFIG, rankMath: sandbox.module.exports.rankMath };
}
module.exports = { harness };
