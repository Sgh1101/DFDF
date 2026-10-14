
(() => {
  const $ = (id) => document.getElementById(id);
  const pause = $("pause");
  document.querySelectorAll(".pz-tabs button").forEach((b) => {
    b.onclick = () => {
      document.querySelectorAll(".pz-tabs button").forEach((x) => x.classList.toggle("on", x === b));
      document.querySelectorAll(".pz-pane").forEach((p) => p.classList.toggle("on", p.dataset.pane === b.dataset.tab));
    };
  });
  const openMenuSettings = () => {
    pause.classList.add("from-menu");
    try {
      paintSettings();
    } catch (e) {}
    pause.hidden = false;
  };
  const closeMenuSettings = () => {
    pause.hidden = true;
    pause.classList.remove("from-menu");
  };
  $("go-set").onclick = openMenuSettings;
  $("pz-close").onclick = closeMenuSettings;
  addEventListener(
    "keydown",
    (e) => {
      if (e.key === "Escape" && pause.classList.contains("from-menu") && !pause.hidden) {
        e.stopImmediatePropagation();
        closeMenuSettings();
      }
    },
    true
  );

  const title = $("s-title"),
    show = $("tt-show"),
    roster = $("title-roster");
  let idx = 0,
    timer = 0;
  function feature(i) {
    idx = (i + AGENTS.length) % AGENTS.length;
    const a = AGENTS[idx];
    show.style.setProperty("--ac", a.color);
    title.style.setProperty("--tt-ac", a.color);
    GAME_PORTRAITS.set($("tt-img"), a, 420, 520, true);
    $("tt-role").textContent = a.role;
    $("tt-name").textContent = a.name;
    $("tt-quote").textContent = a.quote;
    [...roster.children].forEach((c, k) => {
      c.classList.toggle("on", k === idx);
      c.setAttribute("aria-pressed", String(k === idx));
    });
    show.classList.remove("swap");
    void show.offsetWidth;
    show.classList.add("swap");
  }
  function cycle() {
    clearInterval(timer);
    timer = setInterval(() => {
      if (!title.hidden && getComputedStyle(show).display !== "none") feature(idx + 1);
    }, 5200);
  }
  try {
    renderTitleRoster();
  } catch (e) {}
  roster.addEventListener("click", (e) => {
    const c = e.target.closest(".tr-chip");
    if (!c) return;
    feature([...roster.children].indexOf(c));
    cycle();
  });
  show.onclick = () => {
    picked = AGENTS[idx];
    $("go-play").click();
  };
  GAME_BOOT.ready.then(() => {
    feature(Math.floor(Math.random() * AGENTS.length));
    cycle();
  });
})();
