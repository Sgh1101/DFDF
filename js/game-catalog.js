(() => {
  // Read final runtime lists, after server map filtering and all roster additions.
  const counts = () => ({
    agents: AGENTS.length,
    abilities: AGENTS.reduce((n, agent) => n + (agent.abilities || []).length, 0),
    weapons: Object.keys(WEAPONS).length,
    maps: MAP_LIST.length,
    modes: Object.keys(GAME_MODES).length,
    skins: GUN_SKINS.guns().reduce((n, gun) => n + GUN_SKINS.skinsFor(gun).filter((skin) => skin.id !== "default").length, 0),
  });
  const news = [
    { title: ["랭크 시즌", "Ranked seasons"], text: ["4주마다 시즌이 끝납니다. 마친 티어만큼 골드, 골드 이상은 전용 스킨 「월계관」을 모든 총에. RR은 절반부터 다시. 같이 하기 → 랭크전 찾기", "Every four weeks a season ends: gold by the tier you finish on, the Laurel skin on every gun from Gold up, and RR starts again from half. Play together → Find a ranked match"] },
    { title: ["새 요원 가면 · 심판", "New agents 가면 and 심판"], text: ["적의 능력을 따라 쓰고 적으로 변장하는 가면, 옐로카드·타임아웃·오프사이드·레드카드의 심판", "One copies enemy abilities and wears their faces; the other has cards, a whistle and an offside line"] },
    { title: ["칼 대난투 · 총기 순환", "Knife Fight · Gun Game"], text: ["칼만 쓰는 개인전, 킬마다 다음 총으로 바뀌어 칼로 끝내는 개인전", "Knives only; or a new gun with every kill, ending on the knife"] },
    { title: ["달리는 열차", "Runaway Train"], text: ["두 화물열차 위의 3대3. 칸 사이 다리가 20초마다 열리고 닫힙니다", "A 3v3 on two freight trains whose bridges open and close every 20 seconds"] },
    { title: ["찜하기", "Wishlist"], text: ["무기고·상점에서 ★로 찜해 두면 그 스킨이 오늘 상점에 뜰 때 알려 줍니다", "Star a skin in the armoury or the shop: you're told when it's in today's shop"] },
    { title: ["일일 상점", "Daily shop"], text: ["매일 자정에 스킨 20개가 바뀝니다. 뽑기 대신 원하는 스킨을 골드로 바로 삽니다. 무기고 → 상점", "Twenty skins every midnight: buy the one you want with gold. Armoury → Shop"] },
  ];
  window.GAME_CATALOG = Object.freeze({ counts, news: Object.freeze(news.map((item) => Object.freeze({ title: Object.freeze(item.title), text: Object.freeze(item.text) }))) });
})();
