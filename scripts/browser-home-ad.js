// The home screen's AdSense slot (js/home-ad.js, css/home-ad.css): the news column is gone; play.html loads the AdSense
// script with the site's publisher id; the slot asks for one ad only when it has a display-unit id and room to show it
// (wide, tall enough screens), keeps clear of the menu and the agent art, and hides itself when AdSense has nothing.
// The real AdSense script is replaced by a stand-in that records each request and answers filled or unfilled.
const assert = require("node:assert/strict"), { fixture } = require("./browser-fixture");
const STUB = `(function(){var q=window.adsbygoogle||[];window.__adPushes=0;window.adsbygoogle={push:function(){window.__adPushes++;var ins=document.querySelector("ins.adsbygoogle");ins.setAttribute("data-adsbygoogle-status","done");ins.setAttribute("data-ad-status",window.__adFill||"filled");}};for(var i=0;i<q.length;i++)window.adsbygoogle.push(q[i]);})();`;
(async () => {
  const f = await fixture();
  try {
    const open = async (id, viewport, { slot = "", fill = "filled" } = {}) => {
      const requested = [];
      const p = await f.page(id, viewport, {}, {
        beforeLoad: async (page) => {
          await page.route(/^https:\/\/pagead2\.googlesyndication\.com\/pagead\/js\/adsbygoogle\.js/, (route) => { requested.push(route.request().url()); route.fulfill({ contentType: "text/javascript", body: STUB }); });
          if (slot) await page.route("**/play.html", async (route) => { const res = await route.fetch(); await route.fulfill({ response: res, body: (await res.text()).replace('data-ad-slot=""', `data-ad-slot="${slot}"`) }); });
          await page.addInitScript((v) => { window.__adFill = v; }, fill);
        },
      });
      await p.waitForTimeout(800);
      return { p, requested };
    };
    const look = (p) => p.evaluate(() => {
      const box = document.querySelector("#s-title .tt-ad"), r = box.getBoundingClientRect(), hd = document.querySelector(".home-header").getBoundingClientRect();
      const menu = document.getElementById("go-play").getBoundingClientRect(), right = document.querySelector("#s-title .tt-right");
      return { shown: getComputedStyle(box).display !== "none" && r.width > 0, top: r.top, left: r.left, right: r.right, bottom: r.bottom, header: hd.bottom, menuRight: menu.right, vw: innerWidth, vh: innerHeight, pushes: window.__adPushes || 0, news: document.querySelectorAll(".tt-news, #home-newmap, .nm-more").length, pad: getComputedStyle(right).paddingRight, client: document.querySelector("ins.adsbygoogle").dataset.adClient };
    });

    // no display unit yet: the script loads (site verification, Google's consent message) but no box and no request
    let { p, requested } = await open("adnone", { width: 1280, height: 720 });
    let s = await look(p);
    console.log("no unit", JSON.stringify(s));
    assert.equal(requested.length, 1, "play.html loads the AdSense script");
    assert.match(requested[0], /client=ca-pub-3446698746925219$/);
    assert.equal(s.client, "ca-pub-3446698746925219");
    assert.equal(s.news, 0, "the news column and its 'earlier news' button are gone");
    assert.ok(!s.shown && s.pushes === 0, "without a unit id the column stays empty");
    await p.context().close();

    // a unit: one request, the box under the top bar at the right edge, clear of the menu, the agent art moved aside
    ({ p } = await open("adunit", { width: 1280, height: 720 }, { slot: "1234567890" }));
    s = await look(p);
    console.log("unit", JSON.stringify(s));
    assert.ok(s.shown && s.pushes === 1, "one ad request");
    assert.ok(s.top >= s.header - 1 && s.bottom <= s.vh && s.right <= s.vw && s.left > s.menuRight + 40, "the slot sits in the right column " + JSON.stringify(s));
    assert.equal(s.pad, "340px", "the agent art keeps clear of the slot");
    await p.screenshot({ path: process.env.DFDF_SHOT || "/dev/null" }).catch(() => {});
    await p.context().close();

    // nothing to show: the box hides itself
    ({ p } = await open("adempty", { width: 1600, height: 900 }, { slot: "1234567890", fill: "unfilled" }));
    s = await look(p);
    assert.ok(!s.shown && s.pushes === 1, "an unfilled slot is hidden " + JSON.stringify(s));
    await p.context().close();

    // a narrow screen: no box and no request until the window is wide enough
    ({ p } = await open("adnarrow", { width: 1024, height: 600 }, { slot: "1234567890" }));
    s = await look(p);
    assert.ok(!s.shown && s.pushes === 0, "no ad on a narrow screen " + JSON.stringify(s));
    await p.setViewportSize({ width: 1366, height: 768 });
    await p.waitForTimeout(600);
    s = await look(p);
    assert.ok(s.shown && s.pushes === 1, "asked once the column has room " + JSON.stringify(s));
    await p.context().close();

    assert.deepEqual(f.errors, []);
    console.log("home ad: the news column is gone; the AdSense script loads with the site's id; the slot asks once when it has a unit and room, sits clear of the menu and the agent, and hides when unfilled");
  } finally { await f.browser.close(); }
})().then(() => process.exit(0), (e) => { console.error(e); process.exit(1); });
