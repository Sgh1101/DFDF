// The game's server on Render: the API (api/v1.js, api/release.js) and the PeerJS server that players meet through to
// start a match (/peerjs). It sits behind the Cloudflare Worker (cloudflare/worker.mjs), which serves the pages and
// passes /api and /peerjs on here with a shared secret (PROXY_SECRET) and the address the player connected from.
const http = require("node:http");
const express = require("express");
const { WebSocketServer } = require("ws");
const { ExpressPeerServer } = require("peer");

// the largest request body the API takes (Vercel stopped bodies at 4.5 MB; nothing the game sends comes near this)
const BODY_MAX = 1 << 20;

function createServer({ api = require("../api/v1"), release = require("../api/release"), secret = process.env.PROXY_SECRET || "" } = {}) {
  // only the Worker may call in: anyone reaching this server's own address directly could claim any player address
  const fromWorker = (req) => !!secret && req.headers["x-dfdf-proxy"] === secret;
  const app = express();
  app.disable("x-powered-by");
  app.get("/healthz", (req, res) => res.type("text").send("ok"));
  app.use((req, res, next) => {
    if (!fromWorker(req)) return res.status(403).end();
    // the API's limits count by the player's address, which it reads from X-Forwarded-For
    req.headers["x-forwarded-for"] = String(req.headers["x-dfdf-client-ip"] || "").trim() || req.socket.remoteAddress || "";
    delete req.headers["x-dfdf-proxy"];
    res.setHeader("X-Content-Type-Options", "nosniff");
    res.setHeader("Referrer-Policy", "strict-origin-when-cross-origin");
    next();
  });
  // the body is read here, with a limit, and handed to the API as text (api/v1.js reads req.body when it is set)
  const withBody = (handler) => (req, res) => {
    if (req.method !== "POST") return handler(req, res);
    if (+req.headers["content-length"] > BODY_MAX) return res.status(413).end();
    const chunks = [];
    let size = 0;
    const take = (c) => {
      if ((size += c.length) <= BODY_MAX) return chunks.push(c);
      // too big: answered now, and the rest of it is read and dropped
      req.off("data", take);
      req.resume();
      res.status(413).end();
    };
    req.on("data", take);
    req.on("end", () => { if (size <= BODY_MAX) { req.body = Buffer.concat(chunks).toString("utf8"); handler(req, res); } });
  };
  app.all("/api/v1", withBody(api));
  app.all("/api/release", (req, res) => release(req, res));
  const server = http.createServer(app);
  // PeerJS: GET /peerjs/id and the WebSocket at /peerjs (a client with path "/" and the default key "peerjs")
  app.use("/", ExpressPeerServer(server, {
    path: "/",
    proxied: true,
    createWebSocketServer: (options) => new WebSocketServer({ ...options, verifyClient: ({ req }) => fromWorker(req) }),
  }));
  return server;
}

if (require.main === module) {
  process.env.PROXY_SECRET || console.warn("PROXY_SECRET is not set: every request except /healthz is refused");
  const server = createServer();
  server.listen(Number(process.env.PORT) || 10000, () => console.log("DFDF server on port " + server.address().port));
}

module.exports = { createServer };
