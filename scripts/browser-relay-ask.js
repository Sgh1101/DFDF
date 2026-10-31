// The game asks for the relay (TURN) list with its own sign-in token and gets an answer (the server turns away a request
// without one), so rooms keep their relay for players behind strict networks.
const assert = require("node:assert/strict"), { fixture } = require("./browser-fixture");
(async () => {
  const f = await fixture();
  try {
    const asks = [];
    const page = await f.page("relayask", { width: 1280, height: 720 }, {}, {
      beforeLoad: async (p) => p.on("request", (r) => { if (/[?&]a=ice\b/.test(r.url())) asks.push({ method: r.method(), body: r.postDataJSON() }); }),
    });
    await page.waitForFunction(() => window.NET_RELAY !== undefined, null, { timeout: 30000 });
    const token = await page.evaluate(() => JSON.parse(localStorage.getItem("lgp_session")).token);
    assert.ok(asks.length >= 1, "the game asked for the relay list");
    assert.equal(asks[0].method, "POST");
    assert.equal(asks[0].body && asks[0].body.token, token, "with its own token");
    assert.equal(await page.evaluate(() => window.NET_RELAY), false, "the test server has no relay configured, and said so");
    assert.equal((await f.h.api("ice", {})).status, 401, "without a token the server says no");
    assert.deepEqual(f.errors, []);
    console.log("relay list: asked with the sign-in token, answered");
  } finally { await f.browser.close(); }
})().then(() => process.exit(0), (e) => { console.error(e); process.exit(1); });
