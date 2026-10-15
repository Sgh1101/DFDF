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
    { title: ["혼자 또는 친구와", "Solo or with friends"], text: ["혼자 하기는 AI 대전, 같이 하기는 방 목록과 초대 코드", "Solo plays against AI; together opens rooms and invite codes"] },
    { title: ["랭크전", "Ranked"], text: ["관리자·치트가 모두 꺼진 방에서 RR이 오르내립니다. 같이 하기 → 랭크전 찾기", "Admin and cheats are off and RR moves. Play together → Find a ranked match"] },
    { title: ["시프트 아레나", "Shift Arena"], text: ["22초마다 장벽이 오르내리는 3대3 맵", "A 3v3 map whose barriers rise and sink every 22 seconds"] },
  ];
  window.GAME_CATALOG = Object.freeze({ counts, news: Object.freeze(news.map((item) => Object.freeze({ title: Object.freeze(item.title), text: Object.freeze(item.text) }))) });
})();
