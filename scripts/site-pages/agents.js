// 요원: every agent of the game with its four abilities, written from data.json (the game's own AGENTS list).
const { esc, attr } = require("./layout");
const ROLE = {
  타격대: ["Duelist", "앞장서서 길을 여는 돌격수입니다. 화력과 이동 능력으로 사이트에 가장 먼저 들어가거나, 적이 모인 곳을 흔들어 놓습니다. 팀이 따라 들어올 틈을 만드는 것이 일입니다."],
  감시자: ["Sentinel", "한 곳을 단단히 지키는 수비수입니다. 함정, 벽, 감지 장치로 길을 막고 적이 오는 방향을 알려 줍니다. 혼자서도 한쪽 측면을 맡을 수 있어 팀의 등을 지켜 줍니다."],
  척후대: ["Initiator", "정보를 모으고 적을 흔드는 선봉 지원입니다. 적의 위치를 드러내거나 눈을 멀게 해서 팀이 유리하게 교전을 시작하도록 돕습니다."],
  전략가: ["Controller", "연막, 벽, 장판으로 시야와 길을 조절하는 지휘수입니다. 어디를 막고 어디를 열지 정해서 팀이 안전하게 사이트로 들어가거나 후퇴하게 합니다."],
};
const meta = (a) => {
  if (a.ult) return `궁극기 · 충전 ${a.ult}점`;
  const parts = [];
  a.charges > 1 && parts.push(`${a.charges}회`);
  parts.push(a.cd > 0 ? `재사용 ${a.cd}초` : "라운드마다 채움");
  return parts.join(" · ");
};
module.exports = (d) => {
  const has = new Set(d.agentImages || []);
  const card = (a) => `<section class="agent" id="agent-${esc(a.id)}" style="--ac:${attr(a.color)}">
<div style="display:flex;gap:14px;align-items:flex-start">${has.has(a.id) ? `<img src="./assets/site/agents/${esc(a.id)}.webp" alt="${attr(a.name)} 초상" width="96" height="122" loading="lazy" style="flex:none;border-radius:12px;background:#0d121a;width:96px;height:auto">` : ""}<div style="min-width:0"><h3>${esc(a.name)}<span class="role">${esc(a.role)}</span></h3>${a.quote ? `<p class="quote">“${esc(a.quote.replace(/^[“"]|[”"]$/g, ""))}”</p>` : ""}<p class="desc">${esc(a.desc || "")}</p></div></div>
<ul class="abil">${a.abilities.map((x) => `<li><span class="k${x.ult ? " ult" : ""}">${esc(x.key)}</span><b>${esc(x.name)} <small style="color:var(--steel);font-weight:400">${esc(meta(x))}</small></b><span>${esc(x.desc || "")}${x.counterplay ? `<em>상대하는 법: ${esc(x.counterplay)}</em>` : ""}</span></li>`).join("")}</ul>
</section>`;
  const roles = d.roles.slice().sort((a, b) => Object.keys(ROLE).indexOf(a) - Object.keys(ROLE).indexOf(b));
  const count = (r) => d.agents.filter((a) => a.role === r).length;
  const roleCards = roles.map((r) => `<div class="card"><h3>${esc(r)} <small style="color:var(--steel)">${ROLE[r] ? ROLE[r][0] : ""} · ${count(r)}명</small></h3><p>${ROLE[r] ? ROLE[r][1] : ""}</p></div>`).join("");
  const sections = roles.map((r) => `<h2 id="role-${esc(r)}">${esc(r)} ${count(r)}명</h2><div class="agents">${d.agents.filter((a) => a.role === r).map(card).join("\n")}</div>`).join("\n");
  const abilities = d.agents.reduce((n, a) => n + a.abilities.length, 0);
  return {
    file: "agents.html", nav: "agents", lastmod: "2026-10-31", wide: true,
    title: `요원 ${d.agents.length}명`,
    description: `13의 요원 ${d.agents.length}명을 역할별로 소개합니다. 요원마다 다른 능력 네 가지(Q, E, C, 궁극기 X)의 이름과 효과, 상대하는 법을 담았습니다.`,
    h1: `요원 ${d.agents.length}명`,
    lead: `13에서는 경기 시작 전에 요원 한 명을 고릅니다. 요원은 네 역할 가운데 하나에 속하고, 요원마다 능력 네 가지(Q · E · C와 궁극기 X)가 다릅니다. 능력 ${abilities}개는 하나도 겹치지 않습니다.`,
    body: `<div class="roles">${roleCards}</div>
<nav class="filters" aria-label="역할로 이동">${roles.map((r) => `<a href="#role-${esc(r)}">${esc(r)}</a>`).join("")}</nav>
<h2>능력은 이렇게 씁니다</h2>
<p>일반 능력(Q, E, C)은 라운드가 시작될 때 다시 채워집니다. 두 번 쓸 수 있는 능력도 있고, 한 번 쓰면 정해진 시간이 지나야 다시 쓸 수 있는 능력도 있습니다. 궁극기(X)는 점수를 모아야 쓸 수 있습니다. 적을 처치하거나, 적에게 150의 피해를 입히거나, 스파이크를 설치하고 해제하거나, 라운드에서 이기고 지는 것으로 점수가 쌓입니다. 요원을 처음 고른다면 능력 설명이 단순한 요원부터 시작해 보세요. 같은 요원으로 경기를 거듭하면 요원 숙련도가 올라 레벨이 표시됩니다.</p>
<p>요원 선택 화면에서는 팀 안에서 같은 요원을 중복해서 고를 수 없습니다. 모드마다 능력을 쓸 수 있는지가 다르니 <a href="./modes.html">모드 소개</a>에서 확인하세요.</p>
${sections}
<p>능력의 수치는 게임이 업데이트되면서 바뀔 수 있으며, 이 페이지는 현재 게임의 요원 목록에서 자동으로 만들어집니다. 변경 내용은 <a href="./patch-notes.html">패치노트</a>에서 볼 수 있습니다.</p>`,
  };
};
