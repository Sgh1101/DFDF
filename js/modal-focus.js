(() => {
  const specs = [
    ["pause", "설정", "Settings"], ["shop", "무기 구매", "Buy weapons"],
    ["admin", "관리자", "Admin"], ["armory", "무기고", "Armory"],
    ["mis", "미션", "Missions"], ["board", "점수판과 전투 기록", "Scoreboard and combat log"],
    ["bigmap", "전술 지도", "Tactical map"], ["ar-reveal", "뽑기 결과", "Pull results"],
    ["acct-gate", "로그인", "Sign in"], ["acct-wall", "이용 안내", "Account notice"],
    ["mbe-bar", "버튼 배치", "Button layout"],
  ];
  const modals = new Set(), EN = window.GAME_LANG === "en";
  const visible = (node) => node && node.isConnected && !node.hidden && node.getClientRects().length > 0 && getComputedStyle(node).visibility !== "hidden";
  const restore = new WeakMap();
  let active = null;
  function contains(node, item) {
    return node.contains(item) || node.id === "mbe-bar" && item && item.closest(".mbe-part");
  }
  function focusables(node) {
    const items = [...node.querySelectorAll('button,input,select,textarea,a[href],summary,[tabindex]')];
    if (node.id === "mbe-bar") items.push(...document.querySelectorAll(".mbe-part"));
    return items.filter((item) => !item.disabled && item.tabIndex >= 0 && visible(item));
  }
  function layer(node) {
    let score = 0;
    for (let parent = node; parent && parent !== document.body; parent = parent.parentElement) score += Number(getComputedStyle(parent).zIndex) || 0;
    return score;
  }
  function update() {
    const next = [...modals].filter(visible).sort((a, b) => layer(a) - layer(b)).pop() || null;
    if (next === active) return;
    const previous = active, trigger = previous && restore.get(previous);
    active = next;
    if (next) {
      if (!restore.has(next)) restore.set(next, document.activeElement);
      (visible(trigger) && contains(next, trigger) ? trigger : focusables(next)[0] || next).focus({ preventScroll: true });
    } else if (visible(trigger)) trigger.focus({ preventScroll: true });
    if (previous && !visible(previous)) restore.delete(previous);
  }
  function register() {
    for (const [id, ko, en] of specs) {
      const node = document.getElementById(id);
      if (!node || modals.has(node)) continue;
      node.setAttribute("role", "dialog"); node.setAttribute("aria-modal", "true");
      node.setAttribute("aria-label", EN ? en : ko); node.tabIndex = -1;
      node.querySelectorAll('[role="dialog"]').forEach((child) => { if (!specs.some(([id]) => child.id === id)) child.removeAttribute("role"); });
      modals.add(node);
      new MutationObserver(update).observe(node, { attributes: true, attributeFilter: ["hidden", "style", "class"] });
    }
    for (const node of modals) if (!node.isConnected) modals.delete(node);
    update();
  }
  const selector = specs.map(([id]) => "#" + id).join(",");
  new MutationObserver((records) => {
    if (records.some((record) => [...record.addedNodes, ...record.removedNodes].some((node) => node.nodeType === 1 && (node.matches(selector) || node.querySelector(selector))))) register();
  }).observe(document.body, { childList: true, subtree: true });
  window.addEventListener("focusin", (event) => {
    if (active && !contains(active, event.target)) (focusables(active)[0] || active).focus({ preventScroll: true });
  });
  window.addEventListener("keydown", (event) => {
    if (!active || event.key !== "Tab") return;
    event.stopImmediatePropagation();
    const items = focusables(active), index = items.indexOf(document.activeElement);
    event.preventDefault();
    if (!items.length) { active.focus(); return; }
    const next = event.shiftKey ? index <= 0 ? items.length - 1 : index - 1 : (index + 1) % items.length;
    items[next].focus();
  }, true);
  register();
})();
