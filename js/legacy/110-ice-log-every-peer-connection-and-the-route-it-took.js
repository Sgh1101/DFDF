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
  window.iceLogText = () => LOG.map((line) => JSON.stringify(line)).join("\n");
})();
