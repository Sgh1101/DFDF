(() => {
  // The home screen's right column is one AdSense display slot (it used to hold the newest-map card and the news list;
  // the notices carry the news now). The AdSense script itself is loaded in play.html's head. The slot asks for an ad
  // once, when it has a unit id (data-ad-slot, the number of a display unit made in AdSense) and a size: the column is
  // hidden on narrow and short screens, and the whole title screen is hidden during a match. Without a unit id, or when
  // AdSense has nothing to show, the column stays empty instead of showing a blank box.
  const box = document.querySelector("#s-title .tt-ad"),
    ins = box && box.querySelector("ins.adsbygoogle");
  if (!box || !ins) return;
  const EN = "en" === window.GAME_LANG,
    label = box.querySelector(".ad-lbl");
  if (EN) {
    box.setAttribute("aria-label", "Advertisement");
    label && (label.textContent = "Advertisement");
  }
  if (!/^\d{6,}$/.test((ins.getAttribute("data-ad-slot") || "").trim())) return;
  box.classList.add("on");
  const status = () => box.classList.toggle("unfilled", "unfilled" === ins.getAttribute("data-ad-status"));
  new MutationObserver(status).observe(ins, { attributes: !0, attributeFilter: ["data-ad-status"] });
  let asked = !1;
  const ask = () => {
    if (asked || !ins.isConnected || ins.offsetWidth < 250) return;
    asked = !0;
    ro && ro.disconnect();
    try {
      (window.adsbygoogle = window.adsbygoogle || []).push({});
    } catch (e) {}
  };
  const ro = "function" == typeof ResizeObserver ? new ResizeObserver(ask) : null;
  ro ? ro.observe(ins) : addEventListener("resize", ask);
  ask();
  window.HOME_AD = { box, ins, get asked() { return asked; } };
})();
