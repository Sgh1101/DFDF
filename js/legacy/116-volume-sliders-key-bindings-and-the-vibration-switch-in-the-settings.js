(() => {
  // Settings added to the pause menu: the volume sliders (master, effects, footsteps), the key bindings (js/keymap.js: a
  // physical key -> an action -> the keys.* flags the game reads), the vibration switch for touch controls, the colour-blind
  // mode (js/colorblind.js) and the on-screen hints that name keys, which follow the bindings.
  const $ = (id) => document.getElementById(id);
  const L = (ko, en) => ("en" === window.GAME_LANG ? en : ko);
  const pause = $("pause"),
    tabs = document.querySelector("#pause .pz-tabs"),
    set = document.querySelector("#pause .pz-set");
  if (!pause || !tabs || !set || "undefined" == typeof KEYMAP || "undefined" == typeof SETTINGS) return;
  const el = (html) => {
    const t = document.createElement("div");
    t.innerHTML = html.trim();
    return t.firstChild;
  };

  // ── volume (sound tab) ──
  const snd = set.querySelector('[data-pane="snd"]');
  const VOL = [
    ["volMaster", "st-vol-master", L("전체 음량", "Master volume"), L("모든 소리", "Everything you hear")],
    ["volFx", "st-vol-fx", L("효과음 음량", "Effects volume"), L("총성 · 능력 · 피격 · 알림음", "Guns, abilities, hits and alerts")],
    ["volSteps", "st-vol-steps", L("발소리 음량", "Footsteps volume"), L("걸음 소리 (방향도 들립니다)", "Footsteps (you hear which side they come from)")],
  ];
  const pct = (k) => Math.round(100 * SETTINGS[k]);
  if (snd)
    for (const [key, id, name, sub] of VOL) {
      const row = el(`<div class="pz-row pz-wide"><div class="pz-lab">${name}<span id="${id}-v"></span></div><input type="range" id="${id}" min="0" max="100" step="5"><div class="pz-sub">${sub}</div></div>`);
      snd.appendChild(row);
      const input = row.querySelector("input"),
        out = row.querySelector("span");
      const read = () => {
        SETTINGS[key] = Math.min(1, Math.max(0, +input.value / 100));
        out.textContent = pct(key) + "%";
        saveSettings();
        GAME_AUDIO.apply(!0);
      };
      input.addEventListener("input", read);
      input.addEventListener("change", read);
    }

  // ── colour-blind mode (screen effects tab) ──
  const fxp = set.querySelector('[data-pane="fx"]');
  let cbRow = null;
  if (fxp && "undefined" != typeof CB) {
    cbRow = el(`<div class="pz-row pz-wide" id="st-cb"><div class="pz-lab">${L("색약 모드", "Colour-blind mode")}</div><div class="pz-qrow" id="st-cb-opts"></div><div class="pz-sub" id="st-cb-d"></div></div>`);
    fxp.appendChild(cbRow);
    const box = cbRow.querySelector("#st-cb-opts");
    for (const m of CB.MODES) {
      const b = document.createElement("button");
      b.className = "pz-q";
      b.dataset.cb = m;
      b.textContent = CB.names[L("ko", "en")][m];
      b.onclick = () => {
        SETTINGS.colorblind = m;
        saveSettings();
        CB.apply();
        paint();
      };
      box.appendChild(b);
    }
  }
  const paintCb = () => {
    if (!cbRow) return;
    const m = CB.norm(SETTINGS.colorblind);
    cbRow.querySelectorAll(".pz-q").forEach((b) => {
      b.classList.toggle("on", b.dataset.cb === m);
      b.setAttribute("aria-pressed", b.dataset.cb === m ? "true" : "false");
    });
    $("st-cb-d").textContent = CB.descs[L("ko", "en")][m];
  };

  // ── hints that name keys follow the bindings (the default keys print as they always did) ──
  const tips = $("tips");
  // the <b> keys of #tips in page order: [what it shows now, the actions it stands for, how to join several]
  const TIPS = [["WASD", ["forward", "left", "back", "right"], ""], ["SHIFT", ["crouch"]], ["SPACE", ["jump"]], 0, 0, ["R", ["reload"]], ["Q E C X", ["ability1", "ability2", "ability3", "ability4"], " "], ["1 2 3", ["slot1", "slot2", "slot3"], " "], ["4", ["plant"]], ["F", ["use"]], ["F", ["use"]], ["B", ["shop"]]];
  let tipEls = null;
  const paintHints = () => {
    if (!tips) return;
    tipEls || (tipEls = [...tips.querySelectorAll("b")]);
    TIPS.forEach((t, i) => {
      const b = tipEls[i];
      if (!t || !b) return;
      const [orig, ids, sep] = [t[0], t[1], t[2] || ""];
      if (void 0 === b._orig) b._orig = b.textContent.trim();
      if (b._orig !== orig) return;
      const plain = ids.every((id) => KEYMAP.codes(id).join() === KEYMAP.ACTIONS.find((a) => a.id === id).def.join());
      const text = plain ? orig : ids.map((id) => KEYMAP.name(id).toUpperCase()).join(sep || (ids.length > 1 && ids.every((id) => 1 === KEYMAP.name(id).length) ? "" : " "));
      b.textContent !== text && (b.textContent = text);
    });
  };
  KEYMAP.onChange(paintHints);

  // ── vibration (controls tab, touch only) ──
  const ctl = set.querySelector('[data-pane="ctl"]');
  let vib = null;
  if (ctl) {
    vib = el(`<div class="pz-row pz-toggle" id="st-vrow"><div><div class="pz-lab">${L("진동", "Vibration")}</div><div class="pz-sub">${L("터치 버튼을 누를 때 짧게 진동합니다", "A short buzz when you press a touch button")}</div></div><button class="pz-sw" id="st-haptic"><span></span></button></div>`);
    ctl.appendChild(vib);
    vib.querySelector("button").onclick = () => {
      SETTINGS.haptic = !1 === SETTINGS.haptic;
      saveSettings();
      paint();
    };
  }

  // ── keys (its own tab, before the admin tab) ──
  const tab = document.createElement("button");
  tab.dataset.tab = "keys";
  tab.textContent = L("키 설정", "Keys");
  tabs.insertBefore(tab, $("pz-adtab") || null);
  const pane = document.createElement("div");
  pane.className = "pz-pane";
  pane.dataset.pane = "keys";
  const GROUPS = [["move", L("이동", "Movement")], ["combat", L("전투", "Combat")], ["ability", L("능력", "Abilities")], ["other", L("기타", "Other")]];
  let html = "";
  for (const [g, name] of GROUPS) {
    html += `<div class="pz-wide kb-head">${name}</div>`;
    for (const a of KEYMAP.ACTIONS) a.group === g && (html += `<div class="pz-row kb-row"><div class="pz-lab">${L(a.ko, a.en)}</div><button class="kb-key" data-action="${a.id}"></button></div>`);
  }
  html += `<div class="pz-row pz-wide kb-foot"><div class="pz-sub" id="kb-msg" role="status">${L("바꿀 칸을 누르고 새 키를 누르세요. 이미 쓰는 키면 서로 바뀝니다. 사격·조준은 마우스, 일시정지는 Esc로 고정입니다.", "Press a box, then the new key. A key already in use swaps places. Fire and aim stay on the mouse, pause stays on Esc.")}</div><button class="btn" id="kb-reset">${L("키 기본값", "Reset keys")}</button></div>`;
  pane.innerHTML = html;
  set.appendChild(pane);
  const css = document.createElement("style");
  css.textContent = `#pause .kb-head{padding:6px 4px 0;font-size:11px;letter-spacing:.08em;color:var(--steel);text-transform:uppercase}
#pause .kb-row{display:flex;align-items:center;justify-content:space-between;gap:10px;padding:8px 12px}
#pause .kb-key{min-width:92px;padding:7px 12px;border-radius:9px;border:1px solid var(--stroke2);background:rgba(0,0,0,.3);color:var(--ink);font-size:12.5px;font-weight:700;cursor:pointer}
#pause .kb-key:hover{border-color:var(--gold)}
#pause .kb-key.wait{border-color:var(--gold);color:var(--gold);box-shadow:0 0 12px rgba(255,200,73,.35)}
#pause .kb-key.mod{color:var(--gold)}
#pause .kb-foot{display:flex;align-items:center;justify-content:space-between;gap:12px}
#pause .kb-foot .btn{flex:none;padding:9px 16px;font-size:12px}`;
  document.head.appendChild(css);
  const msg = (text) => ($("kb-msg").textContent = text);
  const nameOf = (id) => {
    const a = KEYMAP.ACTIONS.find((x) => x.id === id);
    return a ? L(a.ko, a.en) : id;
  };
  const paintKeys = () => {
    pane.querySelectorAll(".kb-key").forEach((b) => {
      const id = b.dataset.action,
        a = KEYMAP.ACTIONS.find((x) => x.id === id),
        codes = KEYMAP.codes(id);
      b.textContent = codes.map(KEYMAP.label).join(" / ");
      b.classList.toggle("mod", codes.join() !== a.def.join());
      b.classList.remove("wait");
    });
  };

  // listening for the next key (KEYMAP.catcher gets it before every other handler of the page)
  let stop = null;
  const listen = (btn) => {
    stop && stop();
    btn.classList.add("wait");
    btn.textContent = L("키를 누르세요…", "Press a key…");
    const done = () => {
      KEYMAP.catcher = null;
      removeEventListener("pointerdown", onPointer, !0);
      stop = null;
      paintKeys();
    };
    const swallowUp = (e) => {
      // the key-up of the key just chosen must not click the box again (Space, Enter)
      e.preventDefault();
      e.stopImmediatePropagation();
      removeEventListener("keyup", swallowUp, !0);
    };
    const onPointer = (e) => e.target !== btn && done();
    stop = done;
    KEYMAP.catcher = (e) => {
      if (e.repeat) return;
      const code = KEYMAP.codeOf(e);
      if ("Escape" === e.key) return void (done(), msg(L("취소했습니다", "Cancelled")));
      addEventListener("keyup", swallowUp, !0);
      const r = KEYMAP.bind(btn.dataset.action, code);
      done();
      if (!r.ok) return void msg(L("그 키는 쓸 수 없습니다", "That key can't be used"));
      msg(
        r.swapped
          ? L(`${KEYMAP.label(code)}는 ${nameOf(r.swapped)}에 쓰이던 키라 서로 바꿨습니다`, `${KEYMAP.label(code)} was on ${nameOf(r.swapped)}, so the two swapped keys`)
          : `${nameOf(btn.dataset.action)}: ${KEYMAP.label(code)}`,
      );
    };
    addEventListener("pointerdown", onPointer, !0);
  };
  pane.querySelectorAll(".kb-key").forEach((b) => (b.onclick = () => listen(b)));
  $("kb-reset").onclick = () => {
    stop && stop();
    KEYMAP.reset();
    paintKeys();
    msg(L("키를 기본값으로 되돌렸습니다", "Keys are back to their defaults"));
  };
  tab.onclick = () => {
    tabs.querySelectorAll("button").forEach((x) => x.classList.toggle("on", x === tab));
    set.querySelectorAll(".pz-pane").forEach((p) => p.classList.toggle("on", p === pane));
    paintKeys();
  };
  // the other tabs were bound at load and do not know about this pane
  tabs.querySelectorAll("button").forEach((x) => x !== tab && x.addEventListener("click", () => (stop && stop(), pane.classList.remove("on"))));

  function paint() {
    for (const [key, id] of VOL) {
      const i = $(id);
      i && (i.value = pct(key));
      const v = $(id + "-v");
      v && (v.textContent = pct(key) + "%");
    }
    if (vib) {
      vib.hidden = !IS_TOUCH;
      $("st-haptic").classList.toggle("on", !1 !== SETTINGS.haptic);
    }
    paintKeys();
    paintCb();
    CB.apply();
    paintHints();
  }
  // the settings screen repaints through paintSettings (when it opens, after "기본값"); this joins it
  const _ps = paintSettings;
  paintSettings = function () {
    const r = _ps.apply(this, arguments);
    paint();
    return r;
  };
  paint();
})();
