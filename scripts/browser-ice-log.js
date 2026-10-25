const assert = require("node:assert/strict"), { fixture } = require("./browser-fixture");
// Every WebRTC connection the game opens records its ICE story: created, the candidates gathered by type, each ICE
// state, and on connected or broken the route the traffic really took (local and remote candidate type). Two
// connections made on this page with no servers must show a direct host route, and a closed one must say the app closed it.
(async () => {
  const f = await fixture();
  try {
    const p = await f.page("icelog", { width: 960, height: 540 }, {}, { quality: "perf" });
    const out = await p.evaluate(async () => {
      const a = new RTCPeerConnection({ iceServers: [] }), b = new RTCPeerConnection({ iceServers: [] });
      a.createDataChannel("probe");
      a.onicecandidate = (e) => e.candidate && b.addIceCandidate(e.candidate);
      b.onicecandidate = (e) => e.candidate && a.addIceCandidate(e.candidate);
      const offer = await a.createOffer();
      await a.setLocalDescription(offer);
      await b.setRemoteDescription(offer);
      const answer = await b.createAnswer();
      await b.setLocalDescription(answer);
      await a.setRemoteDescription(answer);
      const until = Date.now() + 15000;
      while (Date.now() < until && !["connected", "completed"].includes(a.iceConnectionState)) await new Promise((r) => setTimeout(r, 100));
      const routeAt = Date.now() + 5000;
      while (Date.now() < routeAt && !iceLog().some((l) => l.pc === "pc" + (a.__iceId || "") && /^route:/.test(l.ev))) await new Promise((r) => setTimeout(r, 100));
      const id = a.__iceId, up = a.iceConnectionState;
      a.close();
      b.close();
      await new Promise((r) => setTimeout(r, 200));
      const mine = iceLog().filter((l) => l.pc === id);
      return {
        connected: up,
        events: mine.map((l) => l.ev),
        gathered: (mine.find((l) => l.ev === "gathered") || {}).candidates || null,
        route: (mine.find((l) => /^route:(connected|completed)$/.test(l.ev)) || {}),
        closed: mine.some((l) => l.ev === "closed-by-app"),
        text: iceLogText().split("\n").length,
        role: (mine[0] || {}).role,
      };
    });
    console.log(JSON.stringify(out));
    assert.ok(["connected", "completed"].includes(out.connected), "the two local connections came up: " + out.connected);
    assert.ok(out.events.includes("created") && (out.events.includes("ice:connected") || out.events.includes("ice:completed")), "created and connected are logged: " + out.events.join(","));
    assert.ok(out.gathered && out.gathered.host >= 1, "host candidates counted: " + JSON.stringify(out.gathered));
    assert.equal(out.route.local, "host", "the route in use is direct: " + JSON.stringify(out.route));
    assert.equal(out.route.remote, "host");
    assert.ok(out.closed, "closing is logged as the app's own");
    assert.ok(out.text > 3, "the text dump has the lines");
    assert.deepEqual(f.errors, []);
    console.log("ICE log: every connection records its created, gathered candidates, ICE states and the route in use (host here), closes are marked as the app's. Browser only.");
  } finally { await f.browser.close(); }
})().catch((e) => { console.error(e); process.exit(1); });
