// The contact form (contact.html). It sends through the same feedback API as the game's 문의 · 제안 window: a signed-in
// account's own session when the visitor has one, otherwise a guest session of this device (made here, kept only in
// memory: the homepage's sign-in is left as it was). After sending it lists what this account or device sent before, with
// the owner's status and reply. The e-mail line shows only when the owner set game.contactEmail (admin page).
(() => {
  const API = "/api/v1", $ = (id) => document.getElementById(id);
  const form = $("contactForm");
  if (!form) return;
  const STATUS = { new: "접수됨", read: "확인함", doing: "처리 중", done: "완료", no: "보류 · 어려움" };
  const KIND = { bug: "버그 신고", agent: "요원 제안", report: "사용자 신고", idea: "제안", review: "후기", ask: "문의", other: "기타" };
  const store = { get: (k) => { try { return localStorage.getItem(k); } catch (e) { return null; } }, set: (k, v) => { try { localStorage.setItem(k, v); } catch (e) {} } };
  const device = () => { let d = store.get("lgp_device"); if (!d) { d = "d" + crypto.getRandomValues(new Uint32Array(3)).join("").slice(0, 24); store.set("lgp_device", d); } return d; };
  async function call(a, body) {
    const { response, data } = await GAME_REQUEST(API + "?a=" + a, { method: body ? "POST" : "GET", headers: { "Content-Type": "application/json" }, body: body ? JSON.stringify(body) : undefined });
    if (!data.ok) throw Object.assign(new Error(data.errorKo || data.error || "error"), { status: response.status });
    return data;
  }
  // the token to send with: the account of this browser, else a guest of this device
  let token = null, who = "";
  async function session(fresh) {
    if (token && !fresh) return token;
    let s = null;
    try { s = JSON.parse(store.get("lgp_session") || "null"); } catch (e) {}
    if (s && s.token && !fresh) { token = s.token; who = s.user && !s.user.guest ? s.user.id + " 계정" : "게스트"; return token; }
    const j = await call("guest", { device: device() });
    token = j.token; who = "게스트";
    return token;
  }
  const say = (text, kind) => { const m = $("cMsg"); m.hidden = !text; m.textContent = text || ""; m.className = "msg " + (kind || ""); };
  const when = (t) => { const d = new Date(t); return `${d.getFullYear()}.${d.getMonth() + 1}.${d.getDate()} ${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`; };
  function el(tag, text, cls) { const e = document.createElement(tag); if (text != null) e.textContent = text; if (cls) e.className = cls; return e; }
  async function mine() {
    try {
      let j;
      try { j = await call("feedback_mine", { token: await session() }); } catch (e) { if (e.status !== 401) throw e; j = await call("feedback_mine", { token: await session(true) }); }
      const list = $("mineList"); list.replaceChildren();
      for (const x of j.items) {
        const li = el("li"); li.append(el("b", x.title), el("span", `${KIND[x.type] || x.type} · ${when(x.t)} · ${STATUS[x.status] || STATUS.new}`));
        if (x.reply) li.append(el("div", "답변: " + x.reply, "re"));
        list.append(li);
      }
      $("mineBox").hidden = !j.items.length;
      $("cWho").textContent = who ? who + "(으)로 보냅니다" : "";
    } catch (e) { $("mineBox").hidden = true; }
  }
  // the owner's address, when there is one
  call("config").then((j) => {
    const m = j.config && j.config.game && j.config.game.contactEmail;
    if (!m || !/^[^\s@<>"']+@[^\s@<>"']+\.[^\s@<>"']+$/.test(m)) return;
    const a = $("contactMailLink"); a.href = "mailto:" + m; a.textContent = m; $("contactMail").hidden = false;
  }).catch(() => {});
  $("cType").addEventListener("change", () => { $("cReportBox").hidden = $("cType").value !== "report"; });
  $("cText").addEventListener("input", () => { $("cCount").textContent = $("cText").value.length; });
  form.addEventListener("submit", async (ev) => {
    ev.preventDefault();
    const text = $("cText").value.trim(), type = $("cType").value;
    if (text.length < 5) { say("내용을 5자 이상 적어 주세요", "err"); $("cText").focus(); return; }
    const body = { type, title: $("cTitle").value.trim(), text, contact: $("cContact").value.trim(), ctx: { ua: navigator.userAgent, view: `${innerWidth}x${innerHeight}`, page: "contact", lang: "ko" } };
    if (type === "report") { body.report = { target: $("cTarget").value.trim(), reason: "other", room: "" }; if (!body.report.target) { say("신고할 사용자의 이름을 적어 주세요", "err"); $("cTarget").focus(); return; } }
    $("cSend").disabled = true; say("보내는 중입니다…");
    try {
      let j;
      try { j = await call("feedback_submit", Object.assign({ token: await session() }, body)); } catch (e) { if (e.status !== 401) throw e; j = await call("feedback_submit", Object.assign({ token: await session(true) }, body)); }
      form.reset(); $("cCount").textContent = "0"; $("cReportBox").hidden = true;
      say(`접수되었습니다 (접수 번호 ${j.id}). 운영자가 읽으면 아래 "내가 보낸 문의"에서 상태와 답변을 볼 수 있습니다. 게임 첫 화면 위쪽의 "문의 · 제안" 버튼에서도 같은 목록이 보입니다.`, "ok");
      mine();
    } catch (e) { say(e.message === "offline" ? "서버에 연결할 수 없습니다. 잠시 뒤에 다시 시도해 주세요." : e.message, "err"); }
    finally { $("cSend").disabled = false; }
  });
  mine();
})();
