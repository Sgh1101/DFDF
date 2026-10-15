const fs = require("node:fs");
const vm = require("node:vm");
const cp = require("node:child_process");
for (const file of ["play.html", "index.html", "admin.html"]) {
  const source = fs.readFileSync(file, "utf8");
  let n = 0;
  for (const match of source.matchAll(/<script\b([^>]*)>([\s\S]*?)<\/script\s*>/gi)) {
    if (/\bsrc\s*=/.test(match[1]) || !match[2].trim()) continue;
    new vm.Script(match[2], { filename: `${file}:script-${++n}` });
  }
  console.log(`${file}: ${n} scripts parsed`);
}
cp.execFileSync(process.execPath, ["--check", "api/v1.js"], { stdio: "inherit" });
let files = 0;
function check(directory) {
  for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
    const file = directory + "/" + entry.name;
    if (entry.isDirectory()) check(file);
    else if (file.endsWith(".js")) { new vm.Script(fs.readFileSync(file, "utf8"), { filename: file }); files++; }
  }
}
check("js");
console.log(`${files} external scripts parsed`);
