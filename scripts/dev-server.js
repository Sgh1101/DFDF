const http = require("node:http"), fs = require("node:fs"), path = require("node:path");
const api = require("../api/v1");
const root = path.resolve(__dirname, "..");
const types = { ".html": "text/html; charset=utf-8", ".js": "text/javascript; charset=utf-8", ".css": "text/css; charset=utf-8", ".json": "application/json", ".webmanifest": "application/manifest+json", ".txt": "text/plain; charset=utf-8", ".xml": "application/xml; charset=utf-8", ".svg": "image/svg+xml", ".webp": "image/webp", ".png": "image/png", ".hdr": "application/octet-stream" };
const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, "http://localhost");
  if (url.pathname === "/api/v1") return api(req, res);
  if (url.pathname === '/api/release') return require('../api/release')(req,res);
  let name;
  try { name = decodeURIComponent(url.pathname); } catch (e) { res.writeHead(400); return res.end(); }
  if (name === "/") name = "/index.html";
  if (name === "/admin") name = "/admin.html";
  const file = path.resolve(root, "." + name);
  if (!file.startsWith(root + path.sep)) { res.writeHead(403); return res.end(); }
  fs.stat(file, (error, stat) => {
    if (error || !stat.isFile()) { res.writeHead(404); return res.end("Not found"); }
    res.setHeader("Content-Type", types[path.extname(file)] || "application/octet-stream");
    res.setHeader("Cache-Control", "no-store");
    fs.createReadStream(file).pipe(res);
  });
});
server.listen(Number(process.env.PORT) || 3000, "127.0.0.1", () => console.log("DFDF: http://127.0.0.1:" + server.address().port));
