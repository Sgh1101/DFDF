const test = require("node:test"), assert = require("node:assert/strict"), { harness } = require("./api-harness");
const line = (i, extra = {}) => Object.assign({ t: "2026-10-24T12:00:" + String(i % 60).padStart(2, "0") + ".123Z", pc: "pc" + (i % 5 + 1), role: "client", ev: "ice:failed" }, extra);
test("a bug report keeps the connection log in a strict shape, capped at 40 lines, with no address anywhere", async () => {
  const h = harness(), u = await h.api("auth", { id: "icecase", pw: "password", device: "ice-case" }), owner = await h.api("auth", { id: "owner", pw: "owner-password", device: "owner-ice" });
  const lines = [];
  for (let i = 0; i < 60; i++) lines.push(line(i));
  lines.push({ t: "2026-10-24T12:01:00.000Z", pc: "pc2", role: "client", ev: "route:failed", local: "host", remote: "relay", proto: "udp", rtt: 41.6, host: 2, srflx: 1,
    address: "203.0.113.9", ip: "203.0.113.9", candidate: "candidate:1 1 udp 2122260223 192.168.0.5 51234 typ host", servers: 2, turn: 1, token: "DO_NOT_STORE" });
  lines.push({ t: "2026-10-24T12:01:01.000Z", pc: "pc2", role: "client", ev: "created", servers: ["stun:203.0.113.9:3478"], local: "203.0.113.9", remote: "<b>x</b>", proto: "sctp" });
  lines.push({ t: "not a time 203.0.113.9", pc: "pc 203.0.113.9", role: "203.0.113.9", ev: "203.0.113.9" }); // no valid event: dropped whole
  lines.push("203.0.113.9", null, 5);
  const sent = await h.api("feedback_submit", { token: u.token, type: "bug", text: "연결이 끊겼습니다 (검사)", bug: { where: "연결 끊김", steps: "" }, ctx: { ice: { reason: "host-gone", lines, extra: "DO_NOT_STORE" } } });
  assert.equal(sent.status, 200);
  const all = await h.api("a_feedback", { atoken: owner.atoken }), ice = all.items[0].ctx.ice;
  assert.equal(ice.reason, "host-gone");
  assert.equal(ice.lines.length, 40, "at most 40 lines, the newest");
  const route = ice.lines.find((l) => l.ev === "route:failed");
  assert.deepEqual(route, { t: "2026-10-24T12:01:00.000Z", pc: "pc2", role: "client", ev: "route:failed", local: "host", remote: "relay", proto: "udp", rtt: 42, servers: 2, turn: 1, host: 2, srflx: 1 });
  const created = ice.lines.find((l) => l.ev === "created");
  assert.deepEqual(created, { t: "2026-10-24T12:01:01.000Z", pc: "pc2", role: "client", ev: "created" }, "bad local/remote/proto/servers values are dropped");
  const text = JSON.stringify(all.items);
  for (const bad of ["203.0.113.9", "192.168.0.5", "DO_NOT_STORE", "<b>", "candidate:"]) assert.ok(!text.includes(bad), "stored nothing like " + bad);
  assert.equal(all.counts.ice, 1);
});
test("only a bug report carries the log; an empty or malformed one is not stored; the inbox can filter on it", async () => {
  const h = harness(), u = await h.api("auth", { id: "icecase2", pw: "password", device: "ice-case-2" }), owner = await h.api("auth", { id: "owner", pw: "owner-password", device: "owner-ice2" });
  const ice = { reason: "nonsense", lines: [line(1)] };
  assert.equal((await h.api("feedback_submit", { token: u.token, type: "ask", text: "이건 문의입니다 (연결 기록 없음)", ctx: { ice } })).status, 200);
  h.advance(60001);
  assert.equal((await h.api("feedback_submit", { token: u.token, type: "bug", text: "기록이 비어 있는 버그 신고", ctx: { ice: { reason: "failed", lines: [] } } })).status, 200);
  h.advance(60001);
  assert.equal((await h.api("feedback_submit", { token: u.token, type: "bug", text: "기록이 이상한 버그 신고", ctx: { ice: "x" } })).status, 200);
  h.advance(60001);
  assert.equal((await h.api("feedback_submit", { token: u.token, type: "bug", text: "기록이 있는 버그 신고입니다", ctx: { ice } })).status, 200);
  const all = await h.api("a_feedback", { atoken: owner.atoken });
  assert.equal(all.items.length, 4);
  assert.equal(all.items.filter((x) => x.ctx.ice).length, 1);
  const withIce = all.items.find((x) => x.ctx.ice);
  assert.equal(withIce.type, "bug");
  assert.equal(withIce.ctx.ice.reason, "failed", "an unknown reason falls back to failed");
  const only = await h.api("a_feedback", { atoken: owner.atoken, ice: true });
  assert.deepEqual(only.items.map((x) => x.id), [withIce.id]);
  assert.equal(only.counts.total, 4);
  assert.equal(only.counts.ice, 1);
});
