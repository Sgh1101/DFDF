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
    { title: ["스킨 소리와 피니셔", "Skin sounds and finishers"], text: ["무기고에서 소리 미리듣기 · 일반전 마지막 적 처치 연출", "Try sounds in the armory · standard last-enemy finishers"] },
  ];
  window.GAME_CATALOG = Object.freeze({ counts, news: Object.freeze(news.map((item) => Object.freeze({ title: Object.freeze(item.title), text: Object.freeze(item.text) }))) });
})();
