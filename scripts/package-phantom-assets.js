// Copy the supplied visual data byte-for-byte. No mod code is packaged or run.
const fs = require("node:fs"), path = require("node:path"), crypto = require("node:crypto"), zlib = require("node:zlib");
const A = require("../js/phantom-assets");
const digest = (bytes) => crypto.createHash("sha256").update(bytes).digest("hex");
(async () => {
  const source = process.argv[2] || process.env.PHANTOM_JAR;
  if (!source) throw Error("Pass the supplied JAR path or set PHANTOM_JAR.");
  const jar = fs.readFileSync(source), assets = await A.read(jar.buffer.slice(jar.byteOffset, jar.byteOffset + jar.byteLength), async (bytes) => new Uint8Array(zlib.inflateRawSync(bytes)));
  const names = [...A.required, ...["attacker", "defender"].map((s) => `textures/item/phantom_${s}_glowmask.png`), "geo/finisher/dragon_low.geo.json", ...["cream", "red"].flatMap((s) => [`geo/finisher/serpent_${s}.geo.json`, `textures/finisher/serpent_${s}.png`]), ...["black", "white"].map((s) => `textures/finisher/dragon_low_${s}.png`), ...["1", "2", "3", "4", "5", "_fin"].map((n) => `textures/gui/banner/frame${n}.png`), ...["fin", "new"].flatMap((n) => ["attacker", "defender"].map((s) => `textures/gui/banner/emblem_${n}_${s}.png`))].sort();
  const root = path.resolve(__dirname, "../assets/champions-phantom/2026-0.1.0"), files = [];
  names.push(...require("../js/phantom-finisher-motion").textures.map(name => `textures/finisher/fx/${name}.png`)); names.sort();
  names.push(...require('../js/phantom-gun-wave').textures.map(name => 'textures/vfx/' + name + '.png')); names.sort();
  for (const name of names) {
    const bytes = assets[name]; if (!bytes) throw Error("Missing original asset: " + name);
    const target = path.join(root, name); fs.mkdirSync(path.dirname(target), { recursive: true }); fs.writeFileSync(target, bytes);
    files.push({ name, size: bytes.byteLength, sha256: digest(bytes) });
  }
  const manifest = { version: "2026-0.1.0", author: "Seafle", source: path.basename(source).replace(/^1-/, ""), sourceSha256: digest(jar), files };
  fs.writeFileSync(path.join(root, "manifest.json"), JSON.stringify(manifest, null, 2) + "\n");
  fs.writeFileSync(path.join(root, "SOURCE-NOTICE.txt"), "Original visual data by Seafle, from the user-supplied ChampionsPhantom2026-0.1.0.jar. Included for DFDF at the direction of the user, who confirmed that they are the original creator.\nFiles listed in manifest.json are byte-identical to the entries in that JAR. No texture resizing, recompression, model simplification, Java classes or nested JARs.\nOriginal attribution and restrictions remain with the creator; inclusion here does not grant a general redistribution license.\n");
  console.log(`Packaged ${files.length} original visual files; ${files.reduce((n, f) => n + f.size, 0)} bytes.`);
})().catch((error) => { console.error(error.message); process.exitCode = 1; });
