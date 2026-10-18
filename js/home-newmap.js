(() => {
  // The home screen's right column: a card for the newest map with its real floor plan (three
  // floor tabs, the sites, the stairs) and a button that starts on it, above a play guide that
  // now shows its three newest items and unfolds on request (it used to run the whole height
  // of the screen over the agent's art).
  const news = document.querySelector("#s-title .tt-news");
  if (!news || !window.HOSPITAL_PLAN || "undefined" == typeof MAPS || !MAPS.hospital) return;
  const EN = "en" === window.GAME_LANG,
    L = (ko, en) => (EN ? en : ko);
  const P = window.HOSPITAL_PLAN,
    C = P.cols,
    ROWS = P.buildingRows,
    S = 5; // pixels per cell
  const ZC = { h: "#6c6a60", w: "#5d7a63", o: "#4f8a93", i: "#5b6a86", p: "#8d7f4e", a: "#9d9371", l: "#a3946f", e: "#9a625d", d: "#5e6065", s: "#5f86c9", t: "#585d63", b: "#6fa070" };
  const card = document.createElement("section");
  card.id = "home-newmap";
  card.setAttribute("aria-label", L("새 맵 폐병원", "New map: Abandoned Hospital"));
  card.innerHTML = `<div class="nm-top"><span class="nm-badge">NEW</span><b>${L("폐병원", "Abandoned Hospital")}</b><small>${L("5대5 · 3층 미로", "5v5 · 3-floor maze")}</small></div>
    <canvas id="nm-plan" width="${C * S * 2}" height="${ROWS * S * 2}" aria-hidden="true"></canvas>
    <div class="nm-bar"><div class="nm-tabs" role="group" aria-label="${L("층", "Floor")}"></div><button class="btn nm-go" id="nm-go">${L("이 맵으로 시작", "Play this map")} ›</button></div>
    <p class="nm-note">${L("아트리움을 내려다보는 발코니, 계단 4곳, 옥상 데크. 봇은 1층만 다닙니다.", "A balcony over the atrium, four stairs, roof decks. Bots stay on the ground floor.")}</p>`;
  const cv = card.querySelector("canvas"),
    g = cv.getContext("2d"),
    tabs = card.querySelector(".nm-tabs");
  const edge = (n, kind, r, c) => +P.levels[n][kind][r][c];
  function draw(n) {
    const s = S * 2,
      L0 = P.levels[n];
    g.clearRect(0, 0, cv.width, cv.height);
    g.fillStyle = "#0b0f15";
    g.fillRect(0, 0, cv.width, cv.height);
    for (let r = 0; r < ROWS; r++) for (let c = 0; c < C; c++) {
      const z = L0.f[r][c];
      if (" " === z) continue;
      g.fillStyle = "0" === z ? "#05070a" : "9" === z ? "#1b2433" : ZC[z] || "#666";
      g.globalAlpha = "0" === z || "9" === z ? 1 : 0.82;
      g.fillRect(c * s, r * s, s, s);
    }
    g.globalAlpha = 1;
    g.lineCap = "square";
    for (let r = 0; r <= ROWS; r++) for (let c = 0; c < C; c++) {
      const k = edge(n, "H", r, c);
      k && stroke(c * s, r * s, (c + 1) * s, r * s, k);
    }
    for (let r = 0; r < ROWS; r++) for (let c = 0; c <= C; c++) {
      const k = edge(n, "V", r, c);
      k && stroke(c * s, r * s, c * s, (r + 1) * s, k);
    }
    // stairs: the run on its own floor, the opening on the floor above
    for (const [from, c, r] of P.stairs) {
      if (from !== n && from + 1 !== n) continue;
      g.strokeStyle = from === n ? "#9cc4ff" : "#ffb35c";
      g.lineWidth = 1.5;
      g.strokeRect(c * s + 1, (r - 3) * s + 1, 2 * s - 2, 4 * s - 2);
      if (from === n) {
        g.fillStyle = "#9cc4ff";
        for (let k = 0; k < 4; k++) g.fillRect(c * s + 2, (r - k) * s + 2, 2 * s - 4, 1.4);
      }
    }
    if (0 === n) {
      for (const st of P.sites) {
        const x = (st.x - P.origin[0]) / P.cell * s,
          y = (st.z - P.origin[1]) / P.cell * s;
        g.beginPath();
        g.arc(x, y, 9, 0, Math.PI * 2);
        g.fillStyle = "rgba(255,59,78,.35)";
        g.fill();
        g.strokeStyle = "#ff3b4e";
        g.lineWidth = 1.5;
        g.stroke();
        g.fillStyle = "#fff";
        g.font = "700 11px system-ui, sans-serif";
        g.textAlign = "center";
        g.textBaseline = "middle";
        g.fillText(st.id, x, y + 0.5);
      }
    }
  }
  function stroke(x0, y0, x1, y1, k) {
    g.beginPath();
    g.moveTo(x0, y0);
    g.lineTo(x1, y1);
    g.strokeStyle = 1 === k ? "rgba(236,240,232,.92)" : 4 === k ? "rgba(120,170,230,.5)" : "rgba(255,200,120,.75)";
    g.lineWidth = 1 === k ? 1.6 : 1;
    g.setLineDash(1 === k ? [] : [2, 2]);
    g.stroke();
    g.setLineDash([]);
  }
  const names = [L("1층", "1F"), L("2층", "2F"), L("3층", "3F")];
  names.forEach((name, n) => {
    const b = document.createElement("button");
    b.type = "button";
    b.textContent = name;
    b.setAttribute("aria-pressed", String(0 === n));
    b.onclick = () => {
      tabs.querySelectorAll("button").forEach((x) => x.setAttribute("aria-pressed", String(x === b)));
      draw(n);
    };
    tabs.append(b);
  });
  draw(0);
  card.querySelector("#nm-go").onclick = () => {
    try {
      room.map = "hospital";
    } catch (e) {}
    const go = document.getElementById("go-play");
    go && go.click();
  };
  news.prepend(card);
  // the guide: three newest items, the rest on request
  const label = news.querySelector(".tn-lbl"),
    ul = news.querySelector("ul");
  if (ul) {
    news.classList.add("nm-fold");
    const more = document.createElement("button");
    more.type = "button";
    more.className = "nm-more";
    more.setAttribute("aria-expanded", "false");
    more.textContent = L("지난 소식 보기", "Show earlier news");
    more.onclick = () => {
      const open = news.classList.toggle("nm-open");
      more.setAttribute("aria-expanded", String(open));
      more.textContent = open ? L("접기", "Show less") : L("지난 소식 보기", "Show earlier news");
    };
    ul.after(more);
  }
})();
