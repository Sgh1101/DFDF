(() => {
  const raf = window.requestAnimationFrame.bind(window), cancel = window.cancelAnimationFrame.bind(window), pending = new Map(), scheduled = new Map();
  let resolve, complete = false, failed = false, next = -1;
  const ready = new Promise((done) => { resolve = done; });
  document.documentElement.dataset.gameLoading = "true";
  window.requestAnimationFrame = function (callback) {
    if (complete) return raf(callback);
    const id = next--; pending.set(id, callback); return id;
  };
  window.cancelAnimationFrame = function (id) { if (id < 0) pending.delete(id); else cancel(id); };
  const blockKeys = (event) => { if (!complete) { event.preventDefault(); event.stopImmediatePropagation(); } };
  addEventListener("keydown", blockKeys, true);
  function finish() {
    if (complete || failed) return;
    complete = true; delete document.documentElement.dataset.gameLoading;
    window.requestAnimationFrame = raf;
    window.cancelAnimationFrame = (id) => {
      if (id < 0) { const actual = scheduled.get(id); if (actual !== undefined) cancel(actual); scheduled.delete(id); }
      else cancel(id);
    };
    removeEventListener("keydown", blockKeys, true);
    for (const [id, callback] of pending) scheduled.set(id, raf((time) => { scheduled.delete(id); callback(time); }));
    pending.clear(); resolve();
  }
  function fail(url) {
    failed = true;
    const paint = () => {
      document.documentElement.removeAttribute("data-game-loading");
      const panel = document.createElement("div"); panel.className = "game-load-error"; panel.setAttribute("role", "alert");
      const text = document.createElement("p"); text.textContent = "게임 파일을 불러오지 못했습니다. 연결을 확인하고 다시 시도하세요. / Game loading failed. Check your connection and retry.";
      const retry = document.createElement("button"); retry.textContent = "다시 시도 / Retry"; retry.onclick = () => location.reload();
      panel.append(text, retry); document.body.append(panel);
    };
    document.body ? paint() : addEventListener("DOMContentLoaded", paint, { once: true });
    console.error("Game script unavailable", url);
  }
  window.GAME_BOOT = { ready, finish, fail };
})();
