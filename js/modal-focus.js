(() => {
  const specs = [
    ["pause", "설정", "Settings", "pz-close"],
    ["shop", "무기 구매", "Buy weapons", "shop-close"],
    ["admin", "관리자", "Admin", "ad-close"],
    ["armory", "무기고", "Armory", "ar-close"],
    ["mis", "미션", "Missions", "mis-x"],
  ];
  const modals = [], EN = window.GAME_LANG === "en";
  const visible = (node) => node && !node.hidden && node.getClientRects().length > 0;
  let active = null;
  const restore = new WeakMap();
  function focusables(node) {
    return [...node.querySelectorAll('button,input,select,textarea,a[href],summary,[tabindex]')].filter((item) => !item.disabled && item.tabIndex >= 0 && visible(item));
  }
  function update() {
    const next = modals.filter(visible).sort((a, b) => (Number(getComputedStyle(a).zIndex) || 0) - (Number(getComputedStyle(b).zIndex) || 0)).pop() || null;
    if (next === active) {
      if (active && !active.contains(document.activeElement)) (focusables(active)[0] || active).focus({ preventScroll: true });
      return;
    }
    const previous = active; active = next;
    if (next) {
      if (!restore.has(next)) restore.set(next, document.activeElement);
      (focusables(next)[0] || next).focus({ preventScroll: true });
    } else if (previous) {
      const trigger = restore.get(previous); restore.delete(previous);
      if (visible(trigger)) trigger.focus({ preventScroll: true });
    }
    if (previous && previous !== next && !visible(previous)) restore.delete(previous);
  }
  for (const [id, ko, en] of specs) {
    const node = document.getElementById(id); if (!node) continue;
    node.setAttribute("role", "dialog"); node.setAttribute("aria-modal", "true");
    node.setAttribute("aria-label", EN ? en : ko); node.tabIndex = -1;
    node.querySelectorAll('[role="dialog"]').forEach((child) => child.removeAttribute("role"));
    modals.push(node);
    new MutationObserver(update).observe(node, { attributes: true, attributeFilter: ["hidden", "style", "class"] });
  }
  window.addEventListener("keydown", (event) => {
    if (!active || event.key !== "Tab") return;
    event.stopImmediatePropagation();
    const items = focusables(active), index = items.indexOf(document.activeElement);
    if (!items.length) { event.preventDefault(); active.focus(); return; }
    if (event.shiftKey && index <= 0 || !event.shiftKey && (index < 0 || index === items.length - 1)) {
      event.preventDefault(); items[event.shiftKey ? items.length - 1 : 0].focus();
    }
  }, true);
  update();
})();
