(() => {
  // The owner page can switch an agent off (settings game.disabledAgents: ids, comma separated). An agent that is off is
  // taken out of AGENTS, the one list the picker, the bots, the random pick and the in-match switch all read, so it is
  // gone from all of them; switched on again it is back in its old place. The change is made while the game is on the
  // title or lobby screen (never in the middle of a match), and agentByKey still finds the off ones in case another
  // player's older list still has one.
  if ("undefined" == typeof AGENTS || "undefined" == typeof world) return;
  const ALL = AGENTS.slice(),
    MIN_ON = 10; // the server keeps at least this many on, every role with one
  let pending = null,
    applied = null,
    last = null;
  // agents added by scripts that load after this one (the Neon agent) join the full roster as they appear
  const known = () => {
    let grew = !1;
    for (const a of AGENTS) ALL.includes(a) || (ALL.push(a), (grew = !0));
    return grew;
  };
  const offOf = (c) => new Set(String((c && c.game && c.game.disabledAgents) || "").split(/[\s,]+/).filter(Boolean));
  const keepOf = (off) => {
    const ROLES = [...new Set(ALL.map((a) => a.role))],
      keep = ALL.filter((a) => !off.has(a.id));
    // a mistake in the settings must never leave the game without agents
    return keep.length < MIN_ON || ROLES.some((r) => !keep.some((a) => a.role === r)) ? ALL : keep;
  };
  function apply(off) {
    known();
    last = off;
    const keep = keepOf(off),
      sig = keep.map((a) => a.id).join();
    pending = null;
    if (sig === applied) return;
    applied = sig;
    AGENTS.length = 0;
    keep.forEach((a) => AGENTS.push(a));
    window.AGENT_COUNT = AGENTS.length;
    // the one picked before it went off gives way to the first one still on
    "undefined" != typeof picked && !AGENTS.includes(picked) && (picked = AGENTS[0]);
    try {
      // only a picker that has been drawn is drawn again: the grid is built when it is first opened
      "function" == typeof renderSelect && document.querySelector("#sel-grid .acard") && renderSelect();
    } catch (e) {}
    dispatchEvent(new CustomEvent("agents-changed", { detail: { count: AGENTS.length } }));
  }
  // nothing is switched off while the page is still loading: scripts that load after this one build their tables from the
  // whole roster (the ability profiles check every agent is there)
  const ready = () => "complete" === document.readyState;
  const want = (c) => {
    pending = offOf(c);
    ready() && "menu" === world.phase && apply(pending);
  };
  addEventListener("server-config", (e) => want(e.detail));
  window.SERVER_CFG && want(window.SERVER_CFG);
  // a setting that came in during a match waits for the title screen
  setInterval(() => {
    if ("menu" !== world.phase || !ready()) return;
    // an agent that appeared since (loaded after this script) is checked against the same switches
    if (known() && last) return void apply(last);
    pending && apply(pending);
  }, 800);
  if ("function" == typeof agentByKey) {
    const _ab = agentByKey;
    agentByKey = function (k) {
      return _ab.apply(this, arguments) || ALL.find((a) => a.key === k || a.id === k) || null;
    };
  }
  window.AGENT_SWITCH = { all: () => (known(), ALL), off: () => ALL.filter((a) => !AGENTS.includes(a)).map((a) => a.id), apply, offOf };
})();
