const test = require("node:test"), assert = require("node:assert/strict"), zlib = require("node:zlib");
const A = require("../js/phantom-assets"), { harness } = require("./api-harness");
function fixture() {
  const geo = { "minecraft:geometry": [{ description: { texture_width: 16, texture_height: 16 }, bones: [{ name: "root", pivot: [0, 0, 0], cubes: [{ origin: [0, 0, 0], size: [1, 1, 1], uv: [0, 0] }] }] }] };
  return Object.fromEntries(A.required.map((name) => [name, Buffer.from(name.startsWith("geo/") ? JSON.stringify(geo) : name.startsWith("animations/") ? '{"animations":{"idle":{"loop":true,"bones":{}}}}' : "PNG fixture")]));
}
function zip(files, compressed = false) {
  const locals = [], central = []; let offset = 0;
  for (const [name, bytes] of Object.entries(files)) {
    const n = Buffer.from(name), data = compressed ? zlib.deflateRawSync(bytes) : bytes;
    const local = Buffer.alloc(30), header = Buffer.alloc(46);
    local.writeUInt32LE(0x04034b50); local.writeUInt16LE(compressed ? 8 : 0, 8); local.writeUInt32LE(A.crc32(bytes), 14); local.writeUInt32LE(data.length, 18); local.writeUInt32LE(bytes.length, 22); local.writeUInt16LE(n.length, 26);
    header.writeUInt32LE(0x02014b50); header.writeUInt16LE(compressed ? 8 : 0, 10); header.writeUInt32LE(A.crc32(bytes), 16); header.writeUInt32LE(data.length, 20); header.writeUInt32LE(bytes.length, 24); header.writeUInt16LE(n.length, 28); header.writeUInt32LE(offset, 42);
    locals.push(local, n, data); central.push(header, n); offset += 30 + n.length + data.length;
  }
  const end = Buffer.alloc(22), directory = Buffer.concat(central); end.writeUInt32LE(0x06054b50); end.writeUInt16LE(central.length / 2, 8); end.writeUInt16LE(central.length / 2, 10); end.writeUInt32LE(directory.length, 12); end.writeUInt32LE(offset, 16);
  const bytes = Buffer.concat([...locals, directory, end]); return bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.length);
}
const namespaced = (files) => Object.fromEntries(Object.entries(files).map(([key, bytes]) => ["assets/champions_phantom/" + key, bytes]));
test("JAR imports stored and deflated data assets; executable classes are excluded", async () => {
  for (const compressed of [false, true]) {
    const files = { ...namespaced(fixture()), "com/example/Mod.class": Buffer.from("never execute"), "META-INF/jars/library.jar": Buffer.from("skip") };
    const assets = await A.read(zip(files, compressed), async (bytes) => new Uint8Array(zlib.inflateRawSync(bytes)));
    assert.deepEqual(Object.keys(assets).sort(), A.required.slice().sort()); assert.equal(A.validate(assets).geo.bones.length, 1);
  }
});
test("JAR rejects missing, truncated, traversal, oversized and corrupt data", async () => {
  await assert.rejects(A.read(new ArrayBuffer(5)), /JAR|ZIP/);
  await assert.rejects(A.read(zip({})), /모델/);
  const files = namespaced(fixture()); files["assets/champions_phantom/geo/../escape.json"] = Buffer.from("{}");
  await assert.rejects(A.read(zip(files)), /경로/);
  const broken = zip(namespaced(fixture())); new Uint8Array(broken)[100] ^= 1;
  await assert.rejects(A.read(broken), /손상/);
  assert.throws(() => A.entries(new ArrayBuffer(48 * 1024 * 1024 + 1)), /48MB/);
  const large = zip(namespaced(fixture())); const view = new DataView(large); const at = view.getUint32(large.byteLength - 6, true); view.setUint32(at + 24, 9 * 1024 * 1024, true);
  await assert.rejects(A.read(large), /압축/);
});
test("numeric tracks interpolate deterministically and never evaluate expressions", () => {
  assert.deepEqual(A.sample({ "0": [0, 2, 4], "1": [2, 4, 6] }, 0.5, [0, 0, 0]), [1, 3, 5]);
  assert.deepEqual(A.sample({ "0": { post: [2, 3, 4] } }, 5, [0, 0, 0]), [2, 3, 4]);
  assert.deepEqual(A.sample(["query.life_time", 0, 0], 0, [0, 0, 0]), [0, 0, 0]);
  const assets = fixture(); const g = A.json(assets, A.required[0]); g["minecraft:geometry"][0].bones[0].parent = "root"; assets[A.required[0]] = Buffer.from(JSON.stringify(g));
  assert.throws(() => A.validate(assets), /계층/);
});
test("Phantom account grants and saved equipment fit the scout only", async () => {
  const h = harness(), player = await h.api("auth", { id: "phantom", pw: "password", device: "phantom-device" }), owner = await h.api("auth", { id: "owner", pw: "owner-password", device: "owner-device" });
  for (const id of ["champions_atk", "champions_def"]) {
    assert.equal((await h.api("a_user_set", { atoken: owner.atoken, id: "phantom", op: "grant", item: "rifle|" + id })).status, 400);
    assert.equal((await h.api("a_user_set", { atoken: owner.atoken, id: "phantom", op: "grant", item: "scout|" + id })).status, 200);
    await h.api("skins", { token: player.token, set: { rifle: id, scout: id }, t: h.now() });
    assert.equal(h.user("phantom").skins.m.scout, id); assert.equal(h.user("phantom").skins.m.rifle, undefined);
    h.advance(1000);
  }
  const result = await h.api("skins", { token: player.token });
  assert.deepEqual(result.own.scout, ["champions_atk", "champions_def"]);
});
