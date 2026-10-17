(() => {
  // Read final runtime lists, after server map filtering and all roster additions.
  const counts = () => ({
    agents: AGENTS.length,
    abilities: AGENTS.reduce((n, agent) => n + (agent.abilities || []).length, 0),
    weapons: Object.keys(WEAPONS).length,
    maps: MAP_LIST.length,
    modes: Object.keys(GAME_MODES).filter((key) => !GAME_MODES[key].range).length, // the target range is practice, not a mode to pick
    skins: GUN_SKINS.guns().reduce((n, gun) => n + GUN_SKINS.skinsFor(gun).filter((skin) => skin.id !== "default").length, 0),
  });
  const news = [
    { title: ["새 요원 · 네온", "New agent · Neon"], text: ["추월차선·릴레이볼트·고속기어·오버드라이브. 원본 팔·스킬 아이콘과 슬라이딩 동작을 우리 전투에 연결했습니다", "Fast Lane, Relay Bolt, High Gear and Overdrive, with supplied original arms, icons and slide animation"] },
    { title: ["깃발 탈취 · 축소전", "Capture the Flag · Shrinking Zone"], text: ["적 깃발을 우리 깃발 자리로 가져오는 3점 먼저의 팀전, 한 번뿐인 목숨에 줄어드는 구역의 마지막 한 명 개인전", "Carry their flag to yours, first to 3; or a one-life free for all inside a circle that keeps closing"] },
    { title: ["새 맵 · 야간 항구 · 옥상 도시", "New maps: Night Harbor and Rooftop City"], text: ["밤의 항구 3대3(가로등과 크레인 탐조등), 계단으로 오르는 옥상과 집라인의 5대5 도시", "A 3v3 harbor after dark with street lamps and a crane searchlight; a 5v5 city whose roofs you climb by stairs, with ziplines"] },
    { title: ["감염 · 점령전", "Infection · Conquest"], text: ["술래에게 잡히면 술래가 되는 생존전, 90초마다 옮겨 가는 구역을 오래 차지하는 점령전", "Survive the seeker, or the caught join it; and a hill that moves every 90 seconds"] },
    { title: ["꾸미기 · 주간 특가 · 사격장", "Looks, weekly deal, range"], text: ["골드로 칭호·네임카드·킬 효과를, 주마다 바뀌는 전설 특가를, 혼자 하기 → 사격장에서 표적 연습을", "Titles, name cards and kill effects for gold; a weekly legendary deal; a target range in solo play"] },
    { title: ["랭크 시즌", "Ranked seasons"], text: ["4주마다 시즌이 끝납니다. 마친 티어만큼 골드, 골드 이상은 전용 스킨 「월계관」을 모든 총에. RR은 절반부터 다시. 같이 하기 → 랭크전 찾기", "Every four weeks a season ends: gold by the tier you finish on, the Laurel skin on every gun from Gold up, and RR starts again from half. Play together → Find a ranked match"] },
    { title: ["새 요원 가면 · 심판", "New agents 가면 and 심판"], text: ["적의 능력을 따라 쓰고 적으로 변장하는 가면, 옐로카드·타임아웃·오프사이드·레드카드의 심판", "One copies enemy abilities and wears their faces; the other has cards, a whistle and an offside line"] },
    { title: ["칼 대난투 · 총기 순환", "Knife Fight · Gun Game"], text: ["칼만 쓰는 개인전, 킬마다 다음 총으로 바뀌어 칼로 끝내는 개인전", "Knives only; or a new gun with every kill, ending on the knife"] },
    { title: ["달리는 열차", "Runaway Train"], text: ["두 화물열차 위의 3대3. 칸 사이 다리가 20초마다 열리고 닫힙니다", "A 3v3 on two freight trains whose bridges open and close every 20 seconds"] },
    { title: ["찜하기", "Wishlist"], text: ["무기고·상점에서 ★로 찜해 두면 그 스킨이 오늘 상점에 뜰 때 알려 줍니다", "Star a skin in the armoury or the shop: you're told when it's in today's shop"] },
    { title: ["일일 상점", "Daily shop"], text: ["매일 자정에 스킨 20개가 바뀝니다. 뽑기 대신 원하는 스킨을 골드로 바로 삽니다. 무기고 → 상점", "Twenty skins every midnight: buy the one you want with gold. Armoury → Shop"] },
  ];
  window.GAME_CATALOG = Object.freeze({ counts, news: Object.freeze(news.map((item) => Object.freeze({ title: Object.freeze(item.title), text: Object.freeze(item.text) }))) });
})();
