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
  function command(cmd) {
    if (options.redisCommand) return options.redisCommand(cmd);
    const [op, key, ...args] = cmd;
    switch (op) {
      case "GET": return get(key);
      case "MGET": return [key, ...args].map(get);
      case "ZCARD": case "ZCOUNT": return key === "users" ? [...db.keys()].filter((x) => x.startsWith("user:")).length : 0;
      case "LLEN": return (db.get(key) || []).length;
      case "KEYS": { const re = new RegExp("^" + key.replace(/[.+?^${}()|[\]\\]/g, "\\$&").replace(/\*/g, ".*") + "$"); return [...db.keys()].filter((x) => re.test(x)); }
      case "SET": db.set(key, args[0]); if (args[1] === "EX") expires.set(key, clock + +args[2] * 1000); return "OK";
      case "INCR": case "INCRBY": { const n = +(get(key) || 0) + (op === "INCR" ? 1 : +args[0]); db.set(key, String(n)); return n; }
      case "EXPIRE": expires.set(key, clock + +args[0] * 1000); return 1;
      case "DEL": { const had = db.delete(key); expires.delete(key); return +had; }
      case "EVAL": {
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
  async function api(action, body = {}) {
    let response;
    const res = { setHeader() {}, statusCode: 0, end(value) { response = { status: this.statusCode, ...JSON.parse(value) }; } };
    await sandbox.module.exports({ method: "POST", url: "/api/v1?a=" + action, body, headers: { "x-forwarded-for": "127.0.0.1" } }, res);
    return response;
  }
  const sign = (value) => { const p = Buffer.from(JSON.stringify(value)).toString("base64url"); return p + "." + crypto.createHmac("sha256", "test-secret").update(p).digest("base64url"); };
  return { api, db, sign, advance: (ms) => clock += ms, now: () => clock, failCommit: () => commitFailure = true, failPipeline: () => pipelineFailure = true, user: (id) => JSON.parse(db.get("user:" + id)), config: sandbox.module.exports.DEFAULT_CONFIG };
}
module.exports = { harness };
