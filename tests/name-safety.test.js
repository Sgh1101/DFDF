const test = require("node:test"), assert = require("node:assert/strict"), fs = require("node:fs"), vm = require("node:vm");
const engine = fs.readFileSync("js/legacy/03-engine.js", "utf8");
const part = (from, to) => { const a = engine.indexOf(from); assert.ok(a >= 0, from); const b = engine.indexOf(to, a); assert.ok(b > a, to); return engine.slice(a, b); };
const code = [
  part("function cleanPeerName(", "function lobbyToggleAI("),
  part("function lobbyStart()", "function pickFreeAgent("),
  part("function agentByKey(", "function takeoverCandidates("),
  part("const goneActors", "let lobbyState"),
  part("function takeOver(e, t)", "function freshAIState("),
  part("function autoTeam()", "function spawnPointFor("),
  part("function actorById(", "function teamActors("),
].join("\n");
const TS = 3;
function setup() {
  const c = {
    TEAM_SIZE: TS, BOT_NAMES: ["가", "나", "다", "라", "마", "바"], AGENTS: [{ key: "a1", id: "a1" }, { key: "a2", id: "a2" }],
    NET: { id: "host" }, isAI: (a) => "ai" === a.ctrl, freshAIState: () => ({}), spawnPointFor: () => ({}),
    humanCount: (t) => c.world.actors.filter((a) => a.team === t && a.ctrl !== "ai").length,
    createActor: (id, team, ctrl, agent) => { const a = { id, team, ctrl, agent, alive: true, name: "", yaw: 0 }; c.world.actors.push(a); return a; },
    pickFreeAgent: () => c.AGENTS[0], world: { actors: [], phase: "live" },
    room: { members: new Map(), started: false, slots: { atk: new Array(TS).fill(null), def: new Array(TS).fill(null) } },
  };
  vm.createContext(c); vm.runInContext(code, c);
  return c;
}
const mk = (c, id, team, ctrl) => c.createActor(id, team, ctrl, c.AGENTS[0]);

test("names from peers are text only, at most 16 characters, and legit names are untouched", () => {
  const c = setup();
  for (const ok of ["게스트1234", "Guest1234", "플레이어123", "abc_DEF", "가나", "a".repeat(16)]) assert.equal(c.cleanPeerName(ok), ok);
  const bad = c.cleanPeerName('<img src=x onerror="window.__xss=1">' + "x".repeat(300));
  assert.equal(bad.length <= 16, true);
  assert.doesNotMatch(bad, /[<>&"'`]/);
  assert.equal(c.cleanPeerName("‮\u0007  hi\n"), "hi");
  for (const empty of ["", "   ", null, undefined, "<>&\"'`", "\u0000​"]) assert.equal(c.cleanPeerName(empty), "플레이어");
  assert.equal(typeof c.cleanPeerName({ a: 1 }), "string");
  assert.equal(Array.from(c.cleanPeerName("😀".repeat(40))).length, 16);
});

test("a repeated hello in the lobby keeps one seat and leaving frees it", () => {
  const c = setup();
  const first = c.lobbyAdd("p1", "민수"), again = c.lobbyAdd("p1", "다른이름");
  assert.deepEqual(again, first);
  assert.equal(["atk", "def"].flatMap((t) => c.room.slots[t]).filter((s) => s === "p1").length, 1);
  assert.equal(c.room.members.get("p1").name, "민수");
  c.lobbyRemove("p1");
  assert.equal(["atk", "def"].flatMap((t) => c.room.slots[t]).filter(Boolean).length, 0);
});

test("lobbyStart treats a seat whose member is missing as a bot", () => {
  const c = setup();
  c.lobbyAdd("host", "방장");
  c.room.slots.def[0] = "ghost";
  assert.doesNotThrow(() => c.lobbyStart());
  assert.equal(c.world.actors.find((a) => a.ctrl === "ghost"), undefined);
  assert.equal(c.world.actors.filter((a) => a.ctrl === "ai").length, 1);
});

test("the lobby only accepts agent keys that exist", () => {
  const c = setup();
  c.lobbyAdd("p1", "a");
  for (const key of ["nope", "", null, undefined, 5, {}, ["a1"], "__proto__"]) assert.equal(c.lobbyPickAgent("p1", key), false);
  assert.equal(c.room.members.get("p1").agentKey, null);
  assert.equal(c.lobbyPickAgent("p1", "a2"), true);
  assert.equal(c.room.members.get("p1").agentKey, "a2");
});

function match(c) {
  c.room.started = true;
  for (let i = 0; i < TS; i++) { mk(c, i, "atk", "ai"); mk(c, 10 + i, "def", "ai"); c.room.slots.atk[i] = "ai"; c.room.slots.def[i] = "ai"; }
  c.world.actors.push({ id: 99, team: "atk", ctrl: "host", alive: true }); // keeps the teams uneven so a join goes to def first
}

test("a second hello in a match returns the same body, never another one", () => {
  const c = setup(); match(c);
  const a = c.joinInProgress("p1", "민수");
  const b = c.joinInProgress("p1", "민수", 12, undefined);
  assert.equal(b, a);
  assert.equal(c.world.actors.filter((x) => x.ctrl === "p1").length, 1);
  c.leaveInProgress("p1");
  assert.equal(c.world.actors.filter((x) => x.ctrl === "p1").length, 0);
});

test("actorId is honoured only for the peer's own previous body", () => {
  const c = setup(); match(c);
  const mine = c.joinInProgress("old", "민수");
  const enemy = c.world.actors.filter((x) => x.team !== mine.team && x.ctrl === "ai").pop();
  // no proof of a previous seat: the requested body is ignored, even an enemy one
  const x = c.joinInProgress("evil", "x", enemy.id, undefined);
  assert.notEqual(x.id, enemy.id);
  c.leaveInProgress("evil");
  const y = c.joinInProgress("evil", "x", enemy.id, "old");
  assert.notEqual(y.id, enemy.id);
  c.leaveInProgress("evil");
  // the old seat drops and the same player dials back with prev: same body again
  c.leaveInProgress("old");
  assert.equal(mine.ctrl, "ai");
  const back = c.joinInProgress("new", "민수", mine.id, "old");
  assert.equal(back, mine);
  assert.equal(back.ctrl, "new");
  // the proof is spent
  c.leaveInProgress("new");
  const other = c.joinInProgress("third", "t", mine.id, "old");
  assert.ok(other);
});
