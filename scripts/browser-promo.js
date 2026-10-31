const assert = require("node:assert/strict"), { fixture } = require("./browser-fixture");
// 공지 popup (js/notice-popup.js) and the ▶ 홍보영상 button (js/promo.js) on the homepage: right after signing in a
// card comes up in the middle with the owner's announcement and/or the promo film and an X; closing it (X, Esc,
// backdrop) remembers what it showed, so only a changed announcement or a new film brings it back; never on the
// sign-in view; the owner can switch the film off (game.promoNotice). The film is always the 16:9 one, also on a
// phone held upright. Under the film: a review and a suggestion open the feedback form with that kind chosen, and a
// review lands in the owner's box with its stars. This Chromium cannot decode H.264, so nothing is played: the film
// site is stubbed and only the chosen address is checked.
const HOST = "https://13fps-film.vercel.app", FILM = HOST + "/v/master_16x9.mp4", CALM = HOST + "/v/cut_reduced_16x9.mp4", POSTER = HOST + "/poster.jpg", CAPS = HOST + "/captions.ko.vtt", SITE = HOST + "/";
const PNG = Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR4nGP4z8DwHwAFAAH/q842iQAAAABJRU5ErkJggg==", "base64");
(async () => {
  const f = await fixture();
  try {
    const base = process.env.DFDF_BASE_URL || "http://127.0.0.1:3000", dir = process.env.SHOT_DIR || "/tmp";
    const owner = await f.h.api("auth", { id: "owner", pw: "owner-password", device: "promo-owner" });
    const game = async (patch) => { const c = (await f.h.api("a_config_get", { atoken: owner.atoken })).config; Object.assign(c.game, patch); const r = await f.h.api("a_config_set", { atoken: owner.atoken, config: c }); assert.equal(r.status, 200); };
    // the film site is never reached: poster and captions are stubbed, a film request only happens when play is pressed
    const hits = [];
    const stub = (page) => page.context().route(HOST + "/**", async (route) => {
      const u = route.request().url(); hits.push(u);
      const vtt = /\.vtt$/.test(u);
      await route.fulfill({ status: 200, contentType: vtt ? "text/vtt" : /\.mp4$/.test(u) ? "video/mp4" : "image/png", headers: { "access-control-allow-origin": "*" }, body: vtt ? "WEBVTT\n\n" : PNG });
    });
    // js/promo.js as it would be while the film is not ready: the placeholder address
    const placeholder = (page) => page.route("**/js/promo.js", async (route) => {
      const res = await route.fetch(), body = (await res.text()).replace(`video: "${FILM}"`, 'video: "PROMO_VIDEO_URL"');
      await route.fulfill({ response: res, body, contentType: "text/javascript" });
    });
    // the homepage: still signed in (this tab), or back at the sign-in view when `fresh` (a new visit without "keep me signed in")
    const home = async (page, { fresh = !1, lang = "ko" } = {}) => {
      await page.evaluate(([l, fresh]) => { localStorage.setItem("lgp_lang", l); if (fresh) { sessionStorage.removeItem("lgp_gate"); localStorage.removeItem("lgp_keep"); } }, [lang, fresh]);
      await page.goto(base + "/index.html", { waitUntil: "domcontentloaded" });
      await page.waitForSelector(fresh ? "#v-auth:not([hidden])" : "#v-dash:not([hidden])");
      await page.waitForTimeout(250);
    };
    const signIn = async (page, id = "promo") => { await page.fill("#uid", id); await page.fill("#upw", "password"); await page.click("#doAuth"); await page.waitForSelector("#v-dash:not([hidden])"); };
    const state = (page) => page.evaluate(() => { const b = document.getElementById("np-back"), v = b && b.querySelector("video"); return { open: !!b && !b.hidden, src: v ? v.getAttribute("src") : null, controls: v ? v.controls : null, active: document.activeElement && (document.activeElement.id || document.activeElement.tagName), inside: !!b && b.contains(document.activeElement), locked: document.documentElement.classList.contains("np-lock"), seen: localStorage.getItem("lgp_notice_seen") }; });
    const noPopup = async (page, why) => { await page.waitForTimeout(400); assert.equal((await state(page)).open, false, why); };
    const still = (page) => page.waitForFunction(() => document.getAnimations().filter((a) => a.effect && a.effect.target && a.effect.target.closest("#np-back")).every((a) => "running" !== a.playState));
    // the card is in the middle (within 4px) and on screen
    const centered = async (page, label) => {
      await still(page);
      const r = await page.evaluate(() => { const d = document.getElementById("np").getBoundingClientRect(); return { cx: d.left + d.width / 2 - innerWidth / 2, cy: d.top + d.height / 2 - innerHeight / 2, inside: d.top >= -0.5 && d.left >= -0.5 && d.bottom <= innerHeight + 0.5 && d.right <= innerWidth + 0.5 }; });
      assert.ok(Math.abs(r.cx) <= 4 && Math.abs(r.cy) <= 4 && r.inside, label + ": centered " + JSON.stringify(r));
    };
    // nothing overlaps in the header, nothing scrolls sideways, the card's parts are on screen and can be hit
    const layout = async (page, label, { oneLine, header = !0 } = {}) => (await still(page), page.evaluate(([label, oneLine, header]) => {
      const r = (e) => e.getBoundingClientRect(), out = [];
      const chips = header ? [...document.querySelectorAll(".top > *")].filter((e) => e.offsetParent !== null).map((e) => [e.id || e.className, r(e)]) : [];
      for (let i = 0; i < chips.length; i++) {
        const [id, a] = chips[i];
        if (a.right > innerWidth + 0.5 || a.left < -0.5) out.push(label + ": header item off screen " + id);
        if (Math.abs(a.top - chips[0][1].top) > 40) out.push(label + ": header wraps at " + id);
        if (oneLine && a.height > 44) out.push(label + ": " + id + " wraps its text (" + Math.round(a.height) + "px)");
        for (let j = i + 1; j < chips.length; j++) { const b = chips[j][1]; if (a.left < b.right - 0.5 && b.left < a.right - 0.5 && a.top < b.bottom - 0.5 && b.top < a.bottom - 0.5) out.push(label + ": " + id + " overlaps " + chips[j][0]); }
      }
      if (document.documentElement.scrollWidth > innerWidth) out.push(label + ": sideways scroll");
      const bk = document.getElementById("np-back"), open = !!bk && !bk.hidden;
      if (open) {
        const dlg = document.getElementById("np"), d = r(dlg);
        if (d.top < -0.5 || d.left < -0.5 || d.bottom > innerHeight + 0.5 || d.right > innerWidth + 0.5) out.push(label + ": card outside the screen " + JSON.stringify(d));
        const v = dlg.querySelector("video");
        if (!v.closest("[hidden]") && Math.abs(r(v).width / r(v).height - 16 / 9) > 0.02) out.push(label + ": the film frame is not 16:9 (" + (r(v).width / r(v).height).toFixed(3) + ")");
        for (const s of ["video", ".np-x", ".np-link", '[data-k="review"]', '[data-k="idea"]']) {
          const e = dlg.querySelector(s); if (!e || e.closest("[hidden]")) continue;
          const b = r(e), hit = document.elementFromPoint(b.left + b.width / 2, b.top + b.height / 2);
          if (b.bottom > innerHeight + 0.5 || b.top < -0.5 || b.right > innerWidth + 0.5) out.push(label + ": " + s + " off screen");
          if (!(hit === e || e.contains(hit) || (s === "video" && hit && hit.classList.contains("np-play")))) out.push(label + ": " + s + " is covered");
          if (s !== "video" && b.height < 35.5) out.push(label + ": " + s + " is " + Math.round(b.height) + "px tall");
        }
        const body = dlg.querySelector(".np-body");
        if (body.scrollHeight > body.clientHeight + 1) out.push(label + ": the card needs a scroll");
      }
      return out;
    }, [label, oneLine, header]));
    const touch = { hasTouch: !0, isMobile: !0, deviceScaleFactor: 1 };

    // ================= a phone upright: the whole story
    const page = await f.page("promo", { width: 390, height: 844 }, touch, { promo: !0 });
    await stub(page);
    await game({ announcement: "", promoNotice: !0 });
    // -- the film is not ready (placeholder): no button, and nothing to announce means no card
    await placeholder(page);
    await home(page, { fresh: !0 });
    assert.equal(await page.evaluate(() => window.PROMO.video), "PROMO_VIDEO_URL");
    assert.equal(await page.locator("#np-back").count(), 0, "the sign-in view has no card");
    await signIn(page);
    assert.equal(await page.locator("#promo-open").count(), 0, "no button while the address is the placeholder");
    await noPopup(page, "nothing to announce");
    await page.evaluate(() => { PROMO.video = "/not-absolute.mp4"; PROMO.paint(); });
    assert.equal(await page.locator("#promo-open").count(), 0, "an address that is not http(s) keeps it away too");

    // -- an announcement alone: the card comes up after sign-in, in the middle, without a film
    await game({ announcement: "주말 이벤트" });
    await home(page, { fresh: !0 });
    await noPopup(page, "not on the sign-in view");
    assert.equal(await page.locator("#notices .notice").count(), 0, "the announcement is not an inline bar any more");
    await signIn(page);
    await page.waitForSelector("#np-back:not([hidden])");
    assert.match(await page.textContent("#np .np-ann"), /주말 이벤트/);
    assert.equal(await page.locator("#np .np-film").isVisible(), false, "no film in it");
    assert.match(await page.textContent("#np-h"), /공지/);
    await centered(page, "390 announcement");
    assert.deepEqual(await layout(page, "390 announcement"), []);
    await page.click("#np .np-x");
    let s = await state(page);
    assert.equal(s.open, false); assert.ok(s.seen, "remembered");
    await page.reload({ waitUntil: "domcontentloaded" });
    await page.waitForSelector("#v-dash:not([hidden])");
    await noPopup(page, "the same announcement does not come back");
    await game({ announcement: "점검 끝, 새 맵 추가" });
    await page.reload({ waitUntil: "domcontentloaded" });
    await page.waitForSelector("#np-back:not([hidden])");
    assert.match(await page.textContent("#np .np-ann"), /새 맵 추가/, "a changed announcement shows again");
    await page.keyboard.press("Escape");
    assert.equal((await state(page)).open, false, "Esc closes it");

    // -- the film (as shipped): the card after sign-in carries it; the button is in the header
    await game({ announcement: "" });
    await page.unroute("**/js/promo.js");
    await home(page, { fresh: !0 });
    await noPopup(page, "not on the sign-in view");
    await signIn(page);
    await page.waitForSelector("#np-back:not([hidden])");
    assert.deepEqual(await page.evaluate(() => ({ video: PROMO.video, videoCalm: PROMO.videoCalm, poster: PROMO.poster, captions: PROMO.captions, page: PROMO.page })), { video: FILM, videoCalm: CALM, poster: POSTER, captions: CAPS, page: SITE }, "the shipped config");
    s = await state(page);
    assert.deepEqual([s.open, s.src, s.controls, s.inside, s.locked], [true, FILM, false, true, true], "a phone upright gets the 16:9 film, attached but not playing");
    assert.match(await page.textContent("#np-h"), /홍보영상/);
    assert.equal(await page.locator("#np .np-ann").isVisible(), false);
    const vid = await page.evaluate(() => { const v = document.querySelector("#np video"), t = v.querySelector("track"); return { preload: v.getAttribute("preload"), autoplay: v.autoplay, muted: v.muted, cors: v.getAttribute("crossorigin"), poster: v.getAttribute("poster"), track: t && [t.kind, t.srclang, t.default, t.getAttribute("src")] }; });
    assert.deepEqual(vid, { preload: "none", autoplay: false, muted: false, cors: "anonymous", poster: POSTER, track: ["captions", "ko", true, CAPS] });
    assert.equal(await page.locator("#np .np-play").isVisible(), true, "a play button over the poster");
    assert.ok(!hits.some((u) => /\.mp4$/.test(u)), "no film requested before play is pressed");
    assert.equal(await page.getAttribute("#np .np-link", "href"), SITE);
    assert.equal(await page.getAttribute("#np .np-link", "target"), "_blank");
    assert.match(await page.textContent('#np [data-k="review"]'), /후기 남기기/);
    assert.match(await page.textContent('#np [data-k="idea"]'), /추가했으면 하는 점 보내기/);
    assert.equal(await page.textContent("#np .np-note"), "", "signed in: no sign-in hint");
    await centered(page, "390 film");
    assert.deepEqual(await layout(page, "390 film"), []);
    await page.screenshot({ path: dir + "/promo-popup-phone.png" });
    // Tab and Shift+Tab never leave the card
    for (let i = 0; i < 9; i++) { await page.keyboard.press("Tab"); assert.equal((await state(page)).inside, true, "Tab " + i + " stays inside"); }
    for (let i = 0; i < 9; i++) { await page.keyboard.press("Shift+Tab"); assert.equal((await state(page)).inside, true, "Shift+Tab " + i + " stays inside"); }
    // play: the button goes, the controls appear (nothing is decoded here)
    await page.click("#np .np-play");
    assert.deepEqual(await page.evaluate(() => [document.querySelector("#np .np-play").hidden, document.querySelector("#np video").controls]), [true, true]);
    // X closes: the film is let go and it is remembered
    await page.click("#np .np-x");
    s = await state(page);
    assert.deepEqual([s.open, s.src, s.locked], [false, null, false], "X: closed, film freed");
    assert.ok(s.seen);
    assert.deepEqual(await page.evaluate(() => { const v = document.querySelector("#np video"); return [v.hasAttribute("poster"), v.querySelectorAll("track").length, [0, 3].includes(v.networkState)]; }), [false, 0, true], "poster, captions and the source let go");
    await page.reload({ waitUntil: "domcontentloaded" });
    await page.waitForSelector("#v-dash:not([hidden])");
    await noPopup(page, "the same film does not come up again");
    assert.equal(await page.locator("#promo-open").count(), 1);

    // -- the ▶ button opens the film by hand: X, Esc, backdrop; the button remembers nothing
    assert.match(await page.textContent("#promo-open"), /홍보영상/);
    assert.equal(await page.evaluate(() => document.getElementById("promo-open").nextElementSibling.id), "fbOpen", "next to 문의 in the header");
    assert.equal(await page.evaluate(() => { for (const id of ["orderOpen", "logout"]) document.getElementById(id).hidden = !1; return [...document.querySelectorAll(".top > *")].filter((e) => e.offsetParent !== null).length >= 6; }), true);
    assert.deepEqual(await layout(page, "390 header (everything shown)"), []);
    assert.ok((await page.locator("#promo-open").boundingBox()).height >= 35.5, "36px touch target");
    await page.evaluate(() => { document.getElementById("orderOpen").hidden = !0; });
    assert.deepEqual(await layout(page, "390 header (signed in)", { oneLine: !0 }), [], "one line, nothing squeezed");
    assert.equal(await page.getAttribute("#promo-open", "aria-label"), "홍보영상 보기", "the triangle alone still has a name");
    await page.screenshot({ path: dir + "/promo-button-phone.png" });
    await page.evaluate(() => localStorage.removeItem("lgp_notice_seen"));
    await page.tap("#promo-open");
    await page.waitForSelector("#np-back:not([hidden])");
    assert.equal((await state(page)).src, FILM);
    await page.keyboard.press("Escape");
    s = await state(page);
    assert.deepEqual([s.open, s.src, s.active, s.seen], [false, null, "promo-open", null], "Esc: closed, focus back on the button, nothing remembered by a manual open");
    await page.click("#promo-open");
    await page.click("#np .np-x");
    assert.equal((await state(page)).active, "promo-open");
    // the backdrop; a press that starts inside the card and ends outside does not close it
    await page.click("#promo-open");
    const box = await page.locator("#np").boundingBox();
    await page.mouse.move(box.x + box.width / 2, box.y + 20); await page.mouse.down(); await page.mouse.move(3, 3); await page.mouse.up();
    assert.equal((await state(page)).open, true, "a drag out of the card keeps it");
    await page.mouse.click(3, 3);
    s = await state(page);
    assert.deepEqual([s.open, s.src], [false, null], "backdrop click");
    // reduced motion: no open animation, and the calm cut
    await page.emulateMedia({ reducedMotion: "reduce" });
    await page.click("#promo-open");
    assert.deepEqual(await page.evaluate(() => [getComputedStyle(document.getElementById("np")).animationName, getComputedStyle(document.getElementById("np-back")).animationName]), ["none", "none"]);
    assert.equal((await state(page)).src, CALM, "reduced motion: the calm cut");
    await page.emulateMedia({ reducedMotion: "no-preference" });
    await page.keyboard.press("Escape");
    await page.click("#promo-open");
    assert.notEqual(await page.evaluate(() => getComputedStyle(document.getElementById("np")).animationName), "none", "an animation otherwise");
    await page.keyboard.press("Escape");

    // -- 후기 남기기: the card goes, the form opens on the review kind
    await page.click("#promo-open");
    await page.click('#np [data-k="review"]');
    await page.waitForSelector("#fb-back:not([hidden])");
    s = await state(page);
    assert.deepEqual([s.open, s.src], [false, null], "the card closed and let the film go");
    assert.equal(await page.getAttribute("#fb .fb-types button.on", "data-k"), "review");
    assert.match(await page.textContent("#fb .fb-types button.on"), /⭐ 후기/);
    assert.match(await page.textContent("#fb .fb-types"), /추가했으면 하는 점 \(제안\)/, "the suggestion kind carries its new name");
    assert.equal(await page.locator("#fb .fb-rate button").count(), 5);
    // stars: pick, change, the same star again clears
    await page.click('#fb .fb-rate [data-r="4"]');
    assert.equal(await page.evaluate(() => document.getElementById("fb-rating").value), "4");
    assert.equal(await page.locator("#fb .fb-rate button.on").count(), 4);
    await page.click('#fb .fb-rate [data-r="4"]');
    assert.equal(await page.evaluate(() => document.getElementById("fb-rating").value), "");
    await page.click('#fb .fb-rate [data-r="5"]');
    await page.click('#fb .fb-rate [data-r="3"]');
    assert.equal(await page.getAttribute('#fb .fb-rate [data-r="3"]', "aria-checked"), "true");
    await page.fill("#fb-text", "짧");
    await page.click("#fb-go");
    assert.match(await page.textContent("#fb-msg"), /5자 이상/);
    await page.fill("#fb-title", "영상 잘 봤어요");
    await page.fill("#fb-text", "홍보영상 보고 바로 해 봤는데 재밌네요. 총소리가 좋았습니다.");
    await page.click("#fb-go");
    await page.waitForSelector("#fb-msg.ok");
    assert.match(await page.textContent("#fb-body"), /영상 잘 봤어요/);
    const rec = () => [...f.h.db.entries()].filter(([k]) => k.startsWith("fb:") && !k.startsWith("fbu:") && !k.startsWith("fbdup")).map(([, v]) => JSON.parse(v));
    let stored = rec();
    assert.equal(stored.length, 1);
    assert.deepEqual([stored[0].type, stored[0].rating, stored[0].title, stored[0].ctx.page], ["review", 3, "영상 잘 봤어요", "home"]);
    await page.keyboard.press("Escape");
    assert.equal(await page.evaluate(() => document.getElementById("fb-back").hidden), true);
    assert.equal((await state(page)).active, "promo-open");

    // -- 추가했으면 하는 점 보내기: the suggestion kind (stored as idea), no stars
    await page.click("#promo-open");
    await page.click('#np [data-k="idea"]');
    await page.waitForSelector("#fb-back:not([hidden])");
    assert.equal(await page.getAttribute("#fb .fb-types button.on", "data-k"), "idea");
    assert.equal(await page.locator("#fb .fb-rate").count(), 0);
    await page.fill("#fb-text", "새 맵에 숨을 곳이 더 있으면 좋겠어요.");
    await page.click("#fb-go");
    await page.waitForSelector("#fb-msg.ok");
    stored = rec();
    assert.equal(stored.length, 2);
    assert.equal(stored.find((x) => x.type === "idea").rating, undefined);
    await page.keyboard.press("Escape");

    // -- the owner's box shows the review with its stars; the owner's switch for the film is on the dashboard
    const ctx = await f.browser.newContext({ viewport: { width: 1280, height: 900 } });
    const ap = await ctx.newPage();
    ap.on("pageerror", (e) => f.errors.push(e.message)); ap.on("dialog", (d) => d.accept());
    await ap.route("**/api/v1?*", async (route) => {
      const r = await f.h.api(new URL(route.request().url()).searchParams.get("a"), route.request().postDataJSON() || {});
      await route.fulfill({ status: r.status, contentType: "application/json", body: JSON.stringify(r) });
    });
    await ap.addInitScript((t) => sessionStorage.setItem("adm_t", t), owner.atoken);
    await ap.goto(base + "/admin.html", { waitUntil: "domcontentloaded" });
    await ap.waitForFunction(() => document.getElementById("fbBadge") && document.getElementById("fbBadge").textContent === "2", null, { timeout: 15000 });
    await ap.click('#nav [data-v="feedback"]');
    await ap.waitForSelector(".fbc");
    assert.equal(await ap.locator(".fbc").count(), 2);
    assert.ok((await ap.locator("#ft option").allTextContents()).some((t) => /⭐ 후기/.test(t)), "a filter for reviews");
    assert.ok((await ap.locator("#ft option").allTextContents()).some((t) => /추가했으면 하는 점 \(제안\)/.test(t)), "the suggestion kind is renamed");
    await ap.selectOption("#ft", "review");
    await ap.waitForFunction(() => document.querySelectorAll(".fbc").length === 1);
    const head = await ap.textContent(".fbc summary");
    assert.match(head, /⭐ 후기/); assert.match(head, /★★★/); assert.match(head, /영상 잘 봤어요/);
    await ap.click(".fbc summary");
    const card = await ap.textContent(".fbc .in");
    assert.match(card, /별점/); assert.match(card, /★★★/); assert.match(card, /3\/5/); assert.match(card, /총소리가 좋았습니다/);
    await ap.screenshot({ path: dir + "/promo-admin.png" });
    await ap.click('#nav [data-v="dash"]');
    await ap.waitForSelector('#db-sw [data-p="game.promoNotice"]');
    assert.match(await ap.textContent('#db-sw [data-p="game.promoNotice"]'), /홍보영상 공지 켬/);
    await ap.click('#db-sw [data-p="game.promoNotice"]');
    await ap.waitForFunction(() => /홍보영상 공지 끔/.test(document.querySelector('#db-sw [data-p="game.promoNotice"]').textContent));
    assert.equal((await f.h.api("config", {})).config.game.promoNotice, false, "the chip saved the switch");
    await ctx.close();

    // -- switched off: no button, no film card; an announcement still comes up
    await home(page);
    assert.equal(await page.locator("#promo-open").count(), 0, "no button");
    await noPopup(page, "no film, no announcement: no card");
    await game({ announcement: "공지 B" });
    await page.evaluate(() => localStorage.removeItem("lgp_notice_seen"));
    await page.reload({ waitUntil: "domcontentloaded" });
    await page.waitForSelector("#np-back:not([hidden])");
    assert.equal(await page.locator("#np .np-film").isVisible(), false, "the film card is gone");
    assert.equal(await page.locator("#promo-open").count(), 0);
    await page.keyboard.press("Escape");
    await game({ promoNotice: !0, announcement: "" });

    // -- the language switch repaints the button and the card; English texts
    await home(page, { lang: "en" });
    await page.waitForFunction(() => /Promo/.test(document.getElementById("promo-open").textContent));
    await page.waitForSelector("#np-back:not([hidden])");
    assert.match(await page.textContent("#np-h"), /Promo film/, "the film is back with the switch on again: the card comes up on its own");
    assert.match(await page.textContent("#np .np-link"), /Open in a new tab/);
    assert.match(await page.textContent('#np [data-k="review"]'), /Leave a review/);
    await page.evaluate(() => { document.getElementById("lang").click(); });
    await page.waitForFunction(() => /새 탭에서 보기/.test(document.querySelector("#np .np-link").textContent));
    await page.evaluate(() => { document.getElementById("lang").click(); });
    await page.click('#np [data-k="review"]');
    await page.waitForSelector("#fb-back:not([hidden])");
    assert.match(await page.textContent("#fb .fb-types button.on"), /Review/);
    await page.keyboard.press("Escape");
    // taking the address away again removes the button
    await page.evaluate(() => { PROMO.video = "PROMO_VIDEO_URL"; PROMO.paint(); });
    assert.equal(await page.locator("#promo-open").count(), 0);
    await page.context().close();

    // ================= other screens: after signing in the card is in the middle and fits (with an announcement and the film)
    await game({ announcement: "주말 이벤트", promoNotice: !0 });
    for (const [id, size, opts] of [["promo2", { width: 852, height: 393 }, touch], ["promo3", { width: 1280, height: 800 }, {}], ["promo4", { width: 390, height: 844 }, touch]]) {
      const label = size.width + "x" + size.height;
      const p = await f.page(id, size, opts, { promo: !0 });
      await stub(p);
      await home(p, { fresh: !0 });
      await noPopup(p, label + ": not on the sign-in view");
      await signIn(p, id);
      await p.waitForSelector("#np-back:not([hidden])");
      assert.equal((await state(p)).src, FILM, label + ": the 16:9 film");
      assert.match(await p.textContent("#np .np-ann"), /주말 이벤트/);
      await centered(p, label);
      const issues = await layout(p, label + " card");
      // a short window with an announcement and the film may scroll inside the card, but never off the screen
      assert.deepEqual(issues.filter((x) => !/needs a scroll/.test(x)), []);
      if (size.height > 500) assert.deepEqual(issues, []);
      await p.screenshot({ path: dir + "/promo-card-" + label + ".png" });
      await p.click("#np .np-x");
      assert.equal((await state(p)).open, false);
      // the film alone (the announcement taken away): the card fits without any scroll
      await game({ announcement: "" });
      await p.evaluate(() => localStorage.removeItem("lgp_notice_seen"));
      await p.reload({ waitUntil: "domcontentloaded" });
      await p.waitForSelector("#np-back:not([hidden])");
      await centered(p, label + " film only");
      assert.deepEqual(await layout(p, label + " film only", { oneLine: !0 }), []);
      if (size.width === 852) await p.screenshot({ path: dir + "/promo-popup-landscape.png" });
      await p.click("#np-back", { position: { x: 3, y: 3 } });
      assert.equal((await state(p)).open, false, label + ": the backdrop closes it");
      await game({ announcement: "주말 이벤트" });
      await p.context().close();
    }

    assert.deepEqual(f.errors, []);
    console.log("promo: card after sign-in (announcement and/or film) in the middle, X/Esc/backdrop remember it, a changed announcement returns, never on the sign-in view, 16:9 film on a phone upright, ▶ button reopens it, switch off by game.promoNotice, review and suggestion open the form, the review shows with stars in the owner's box, 390x844 / 852x393 / 1280x800 fit");
  } finally { await f.browser.close(); }
})().then(() => process.exit(0), (e) => { console.error(e); process.exit(1); });
