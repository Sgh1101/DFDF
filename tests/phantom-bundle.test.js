const test = require("node:test"), assert = require("node:assert/strict"), fs = require("node:fs"), path = require("node:path"), crypto = require("node:crypto"), cp = require("node:child_process"), os = require("node:os");
const A = require("../js/phantom-assets"), root = path.resolve(__dirname, "../assets/champions-phantom/dfdf-1");
const manifest = JSON.parse(fs.readFileSync(path.join(root, "manifest.json"), "utf8"));
const sha256 = (bytes) => crypto.createHash("sha256").update(bytes).digest("hex");
const fetcher = async (address) => new Response(fs.readFileSync(path.join(root, address.split('?')[0].slice("bundle/".length))));
const cubes = (geo) => geo.bones.reduce((n, b) => n + (b.cubes?.length || 0), 0);
test("bundled Phantom loads DFDF's own generated model, finisher and full-resolution textures with verified bytes", async () => {
  const assets = await A.bundled(fetcher, "bundle/"), { geo, clips } = A.validate(assets);
  assert.equal(manifest.author, "DFDF");
  assert.ok(cubes(geo) > 60, "the gun is a full cube model");
  for (const bone of ["magazine", "mag_and_lefthand", "charge_handle", "bolt", "trigger", "mag_release", "muzzle_pos"]) assert.ok(geo.bones.some((b) => b.name === bone), bone + " attachment/motion bone");
  for (const clip of ["idle", "draw", "shoot", "shoot_aim", "reload_tactical", "inspect"]) assert.ok(clips[clip], clip + " clip");
  assert.equal(manifest.files.length, 39);
  for (const name of ["dragon_low", "serpent_red", "serpent_cream"]) {
    const model = JSON.parse(new TextDecoder().decode(assets[`geo/finisher/${name}.geo.json`]))["minecraft:geometry"][0];
    assert.ok(cubes(model) > 100, name + " has a full body");
    assert.ok(model.bones.some((b) => b.name === "head"), name + " has a head");
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
  assert.match(fs.readFileSync(path.join(root, "SOURCE-NOTICE.txt"), "utf8"), /original DFDF work/);
});
test("the committed pack is exactly what the generator produces", () => {
  // Regenerate into a temporary folder and compare every byte with the committed pack.
  const before = Object.fromEntries(manifest.files.map((f) => [f.name, f.sha256]));
  const out = fs.mkdtempSync(path.join(os.tmpdir(), "champions-build-"));
  try {
    cp.execFileSync(process.execPath, [path.resolve(__dirname, "../scripts/champions-phantom/build.js")], { stdio: "pipe", env: { ...process.env, CHAMPIONS_OUT: out } });
    const fresh = JSON.parse(fs.readFileSync(path.join(out, "manifest.json"), "utf8"));
    assert.deepEqual(Object.fromEntries(fresh.files.map((f) => [f.name, f.sha256])), before);
    for (const name of ["samples.json", "kill-sequences.json", "music-sequences.json"]) assert.deepEqual(fs.readFileSync(path.join(out, "audio", name)), fs.readFileSync(path.join(root, "audio", name)), name);
  } finally { fs.rmSync(out, { recursive: true, force: true }); }
});
test("bundled loader rejects damaged, missing or unsafe assets instead of silently accepting substitutes", async () => {
  await assert.rejects(A.bundled(async (address) => address.endsWith("phantom_attacker.png") ? new Response("wrong texture") : fetcher(address), "bundle/"), /손상/);
  await assert.rejects(A.bundled(async (address) => address.split('?')[0].endsWith("manifest.json") ? fetcher(address) : new Response("", { status: 404 }), "bundle/"), /불러오지/);
  const invalid = { ...manifest, files: [{ ...manifest.files[0], name: "../mod.class" }] };
  await assert.rejects(A.bundled(async () => new Response(JSON.stringify(invalid)), "bundle/"), /항목/);
});
test('the updated bundle bypasses an old worker cached manifest and includes every kill-coat effect',async()=>{
  let requested='';const assets=await A.bundled(async(address,options)=>{
    if(address.includes('manifest.json')){requested=address;assert.equal(options.cache,'no-cache');if(!address.includes('?revision='))return new Response(JSON.stringify({...manifest,files:manifest.files.filter(f=>!f.name.startsWith('textures/vfx/'))}));}
    return fetcher(address);
  },'bundle/');
  assert.ok(requested.includes('?revision='));
  for(const name of ['gunart_side','gunart_top','lick_attacker','lick_defender'])assert.ok(assets['textures/vfx/'+name+'.png']);
});
