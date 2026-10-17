(() => {
  const GS = window.GUN_SKINS, ids = ["champions_atk", "champions_def"];
  const $ = (id) => document.getElementById(id), L = (ko, en) => window.GAME_LANG === "en" ? en : ko;
  const session = () => window.ACCOUNT?.session(), token = () => session()?.token || "";
  const state = { token: "", coins: null, ready: false, busy: false, armed: "", message: "" };
  let sequence = 0;
  const box = document.createElement("section"); box.id = "champion-shop";
  box.innerHTML = `<div class="champion-heading"><h3>${L("챔피언스 구매", "Buy Champions")}</h3><b id="champion-coins" aria-live="polite"></b></div>
    <p>${L("경기 완료마다 초월 코인 1개 · 스킨 한 종류당 700개", "1 Transcendent coin per completed match · 700 per skin")}</p>
    <div class="champion-offers">${ids.map((id, i) => `<button type="button" data-champion-buy="${id}" disabled><strong>${i ? L("수비 · 상아빛", "Defense · Ivory") : L("공격 · 붉은빛", "Attack · Crimson")}</strong><span></span></button>`).join("")}</div>
    <p id="champion-shop-status" role="status"></p>`;
  $("phantom-panel").before(box);
  function paint() {
    const same = state.token === token(), ready = same && state.ready;
    $("champion-coins").textContent = L("초월 코인 ", "Transcendent coins ") + (ready ? state.coins.toLocaleString() : "—");
    for (const button of box.querySelectorAll("[data-champion-buy]")) {
      const id = button.dataset.championBuy, owned = ready && GS.owns("carbine", id);
      button.disabled = state.busy || !ready || (!owned && state.coins < 700);
      button.classList.toggle("owned", owned); button.classList.toggle("armed", state.armed === id);
      button.querySelector("span").textContent = owned ? L("보유 중 · 장착", "Owned · Equip") : state.armed === id ? L("700코인으로 구매 확인", "Confirm purchase · 700 coins") : L("700 초월 코인", "700 Transcendent coins");
    }
    $("champion-shop-status").textContent = !token() ? L("접속 후 코인을 모아 구매할 수 있습니다.", "Sign in or start as a guest to earn coins.") : state.busy ? L("처리 중…", "Working…") : state.message || (!ready ? L("코인 잔액을 불러오는 중…", "Loading coins…") : state.coins < 700 ? L(`구매까지 ${700 - state.coins}코인 남았습니다. 승패와 관계없이 경기를 완료하면 1개를 받습니다.`, `${700 - state.coins} coins to go. Finish a match to earn one, win or lose.`) : L("구매 버튼을 두 번 눌러 확정합니다.", "Press a purchase button twice to confirm."));
  }
  async function refresh() {
    if (state.busy) return;
    const captured = token(), request = ++sequence;
    if (state.token !== captured) Object.assign(state, { token: captured, coins: null, ready: false, armed: "", message: "" });
    paint(); if (!captured) return;
    try {
      const result = await ACCOUNT.api("champion_shop", { token: captured });
      if (captured !== token() || request !== sequence) return;
      GS.receive(result); state.coins = result.championCoins; state.ready = true;
    } catch (error) { if (captured === token() && request === sequence) state.message = error.message; }
    if (captured === token() && request === sequence) paint();
  }
  async function buy(id) {
    if (state.busy || !state.ready || state.token !== token()) return;
    if (GS.owns("carbine", id)) return CHAMPIONS_PHANTOM.choose(id);
    if (state.coins < 700) return;
    if (state.armed !== id) { state.armed = id; state.message = L("한 번 더 누르면 초월 코인 700개를 사용합니다.", "Press again to spend 700 Transcendent coins."); return paint(); }
    const captured = token(); ++sequence; state.busy = true; state.armed = ""; paint();
    try {
      const result = await ACCOUNT.api("champion_buy", { token: captured, g: "carbine", s: id });
      if (captured !== token()) return;
      GS.receive(result); state.coins = result.championCoins;
      CHAMPIONS_PHANTOM.choose(id); state.message = L("구매하고 장착했습니다. 초월 코인 700개를 사용했습니다.", "Purchased and equipped. Spent 700 Transcendent coins.");
    } catch (error) { if (captured === token()) state.message = error.message; }
    finally { state.busy = false; if (captured === token()) paint(); else refresh(); }
  }
  box.querySelectorAll("[data-champion-buy]").forEach((button) => button.onclick = () => buy(button.dataset.championBuy));
  addEventListener("champion-wallet", (event) => {
    if (state.token !== token() || !Number.isSafeInteger(event.detail.coins)) return;
    state.coins = event.detail.coins; paint();
  });
  addEventListener("account-reward", () => { if (GS.isOpen()) refresh(); });
  addEventListener("champions-open", () => { state.armed = ""; state.message = ""; refresh(); });
  addEventListener("storage", (event) => { if (event.key === "lgp_session" && GS.isOpen()) refresh(); });
  new MutationObserver(() => { state.armed = ""; state.message = ""; if (!$("armory").hidden) refresh(); }).observe($("armory"), { attributes: true, attributeFilter: ["hidden"] });
  const hash = () => { if (location.hash !== "#champion-shop") return; GS.open("carbine", "champions"); refresh(); };
  addEventListener("hashchange", hash); GAME_BOOT.ready.then(hash);
  window.CHAMPION_SHOP = { refresh }; paint();
})();
