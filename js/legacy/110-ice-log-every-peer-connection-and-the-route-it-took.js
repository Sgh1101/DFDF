(() => {
  // ICE log: every WebRTC connection the multiplayer opens (host and guests alike) records its own story, so a dropped
  // guest can be explained: which route the two sides settled on (direct: host/srflx, or relayed: relay), how the ICE
  // state moved, and whether the game closed it itself. Nothing leaves the browser; the log is kept in memory (the
  // last 300 lines), printed to the console as "[ice]", and readable with iceLog() or iceLogText().
  //   route:* lines come from the stats of the pair that carries the traffic, read on connected/completed (the route
  //   that is in use) and on failed/disconnected (the route that was in use when it broke).
  const Native = window.RTCPeerConnection;
  if (typeof Native !== "function" || Native.__iceLog) return;
  const LOG = [], MAX = 300;
  let seq = 0;
  const record = (pc, ev, data) => {
    const line = Object.assign({ t: new Date().toISOString(), pc: pc.__iceId, role: (typeof NET !== "undefined" && NET.mode) || "-", ev }, data || {});
    LOG.push(line);
    if (LOG.length > MAX) LOG.shift();
    console.info("[ice]", line);
    // a connection that broke (or is breaking): keep the story where a reload cannot lose it
    if (/^(ice|route):(failed|disconnected)$/.test(ev)) window.iceSave && window.iceSave(ev.slice(4));
  };
  class Logged extends Native {
    constructor(config, constraints) {
      super(config, constraints);
      this.__iceId = "pc" + ++seq;
      this.__gathered = {};
      const servers = ((config && config.iceServers) || []).flatMap((s) => [].concat(s.urls || []));
      record(this, "created", { servers });
      this.addEventListener("icecandidate", (e) => {
        if (e.candidate) {
          const type = e.candidate.type || "?";
          this.__gathered[type] = (this.__gathered[type] || 0) + 1;
        } else record(this, "gathered", { candidates: Object.assign({}, this.__gathered) });
      });
      this.addEventListener("iceconnectionstatechange", () => {
        const state = this.iceConnectionState;
        record(this, "ice:" + state);
        if (["connected", "completed", "failed", "disconnected"].includes(state)) this.__route(state);
      });
      this.addEventListener("connectionstatechange", () => record(this, "conn:" + this.connectionState));
    }
    close() {
      record(this, "closed-by-app", { ice: this.iceConnectionState });
      return super.close();
    }
    async __route(state) {
      try {
        const report = await this.getStats();
        let selected = null;
        report.forEach((r) => { if (r.type === "transport" && r.selectedCandidatePairId) selected = r.selectedCandidatePairId; });
        let pair = selected && report.get(selected);
        if (!pair) report.forEach((r) => { if (!pair && r.type === "candidate-pair" && r.nominated && r.state === "succeeded") pair = r; });
        const local = pair && report.get(pair.localCandidateId);
        const remote = pair && report.get(pair.remoteCandidateId);
        record(this, "route:" + state, {
          local: local ? local.candidateType : null,
          localProtocol: local ? local.protocol : null,
          remote: remote ? remote.candidateType : null,
          rttMs: pair && pair.currentRoundTripTime != null ? Math.round(pair.currentRoundTripTime * 1000) : null,
          gathered: Object.assign({}, this.__gathered),
        });
      } catch (error) {
        record(this, "route-error", { message: String((error && error.message) || error) });
      }
    }
  }
  Logged.__iceLog = true;
  window.RTCPeerConnection = Logged;
  window.iceLog = () => LOG.slice();
  // The compact copy that can go with a bug report: the last 40 lines reduced to times, states, candidate TYPES, the
  // protocol and the round-trip time. Never a candidate address, and never the server list itself (only how many).
  const KEEP = 40, STORE = "lgp_ice_report";
  window.iceSummary = (n) => LOG.slice(-(n || KEEP)).map((l) => {
    const g = l.gathered || l.candidates || {}, out = { t: String(l.t || "").slice(0, 24), pc: l.pc, role: l.role, ev: l.ev };
    if (l.local) out.local = l.local;
    if (l.remote) out.remote = l.remote;
    if (l.localProtocol) out.proto = l.localProtocol;
    if (l.rttMs != null) out.rtt = l.rttMs;
    if (l.ice) out.ice = l.ice;
    if (l.servers) { out.servers = l.servers.length; out.turn = l.servers.filter((u) => /^turns?:/i.test(u)).length; }
    for (const k of ["host", "srflx", "prflx", "relay"]) if (g[k]) out[k] = g[k];
    return out;
  });
  // kept in sessionStorage so it survives the redirect or reload that follows a drop; reason: failed / disconnected / host-gone
  window.iceSave = (reason, offer) => {
    try {
      let prev = null;
      try { prev = JSON.parse(sessionStorage.getItem(STORE) || "null"); } catch (e) {}
      sessionStorage.setItem(STORE, JSON.stringify({ saved: Date.now(), reason, offer: offer == null ? (prev && prev.offer ? 1 : 0) : offer ? 1 : 0, lines: window.iceSummary() }));
    } catch (e) {}
  };
  // only the "offer the report card" flag changes; the saved lines stay (after a reload the in-memory log is empty)
  window.iceOffer = (offer) => {
    try {
      const r = JSON.parse(sessionStorage.getItem(STORE) || "null");
      r && (r.offer = offer ? 1 : 0, sessionStorage.setItem(STORE, JSON.stringify(r)));
    } catch (e) {}
  };
  window.iceSaved = (maxAgeMs) => {
    try {
      const r = JSON.parse(sessionStorage.getItem(STORE) || "null");
      return r && Array.isArray(r.lines) && r.lines.length && Date.now() - r.saved <= (maxAgeMs || 30 * 60000) ? r : null;
    } catch (e) { return null; }
  };
  window.iceClear = () => { try { sessionStorage.removeItem(STORE); } catch (e) {} };
  window.iceLogText = () => LOG.map((line) => JSON.stringify(line)).join("\n");
})();
