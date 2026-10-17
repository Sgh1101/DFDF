const test = require("node:test"), assert = require("node:assert/strict"), fs = require("node:fs"), path = require("node:path"), crypto = require("node:crypto"), zlib = require("node:zlib");
const A = require("../js/phantom-assets"), root = path.resolve(__dirname, "../assets/champions-phantom/2026-0.1.0");
const manifest = JSON.parse(fs.readFileSync(path.join(root, "manifest.json"), "utf8"));
const sha256 = (bytes) => crypto.createHash("sha256").update(bytes).digest("hex");
const fetcher = async (address) => new Response(fs.readFileSync(path.join(root, address.slice("bundle/".length))));
test("bundled Phantom preserves all 878 source cubes and full-resolution textures with verified bytes", async () => {
  const assets = await A.bundled(fetcher, "bundle/"), { geo } = A.validate(assets);
  assert.equal(geo.bones.reduce((n, b) => n + (b.cubes?.length || 0), 0), 878);
  assert.equal(manifest.files.length, 23);
  for (const [name, count] of [["dragon_low", 214], ["serpent_red", 256], ["serpent_cream", 259]]) {
    const original = JSON.parse(new TextDecoder().decode(assets[`geo/finisher/${name}.geo.json`]))["minecraft:geometry"][0];
    assert.equal(original.bones.reduce((n, b) => n + (b.cubes?.length || 0), 0), count, name + " keeps all source cubes");
  }
  for (const file of manifest.files) {
    const bytes = fs.readFileSync(path.join(root, file.name));
    assert.equal(bytes.length, file.size); assert.equal(sha256(bytes), file.sha256);
    assert.match(file.name, /^(geo|animations|textures)\//);
  }
  for (const side of ["attacker", "defender"]) for (const suffix of ["", "_glowmask"]) {
    const png = Buffer.from(assets[`textures/item/phantom_${side}${suffix}.png`]);
    assert.equal(png.readUInt32BE(16), 512); assert.equal(png.readUInt32BE(20), 512);
  }
  if (process.env.PHANTOM_JAR) {
    const jar = fs.readFileSync(process.env.PHANTOM_JAR);
    assert.equal(sha256(jar), manifest.sourceSha256, "the package comes from the supplied JAR");
    const original = await A.read(jar.buffer.slice(jar.byteOffset, jar.byteOffset + jar.byteLength), async (bytes) => new Uint8Array(zlib.inflateRawSync(bytes)));
    for (const file of manifest.files) assert.deepEqual(Buffer.from(assets[file.name]), Buffer.from(original[file.name]), file.name + " is byte-identical to the supplied source");
  }
});
test("bundled loader rejects damaged, missing or unsafe assets instead of silently accepting substitutes", async () => {
  await assert.rejects(A.bundled(async (address) => address.endsWith("phantom_attacker.png") ? new Response("wrong texture") : fetcher(address), "bundle/"), /손상/);
  await assert.rejects(A.bundled(async (address) => address.endsWith("manifest.json") ? fetcher(address) : new Response("", { status: 404 }), "bundle/"), /불러오지/);
  const invalid = { ...manifest, files: [{ ...manifest.files[0], name: "../mod.class" }] };
  await assert.rejects(A.bundled(async () => new Response(JSON.stringify(invalid)), "bundle/"), /항목/);
});
