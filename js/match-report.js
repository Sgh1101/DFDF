(function (root) {
  // A match's ticket, asked for when it starts. One the server would not give (its limit on matches started, or no
  // answer) is asked for again while the match runs: a later ticket only counts the rest of the match, but that beats
  // none. missed() says why the match finish() just closed has no ticket.
  function create({ request, token, onError = () => {}, retryMs = 60000 }) {
    let current = null, missed = null;
    const again = (e) => !e || !e.status || 429 === e.status || e.status >= 500;
    return {
      begin(fresh = false) {
        if (!token()) return null;
        if (current && !fresh) return current;
        const run = { token: token(), ticket: "", error: null };
        current = run;
        const ask = (first) => request(run.token).then((result) => { run.ticket = result.ticket || ""; run.error = null; }, (e) => {
          run.error = e || new Error("");
          first && onError(e);
          current === run && again(e) && (run.timer = setTimeout(() => { current === run && (run.promise = ask(false)); }, retryMs));
        });
        run.promise = ask(true);
        return run;
      },
      async finish() {
        const run = current; current = null; missed = null;
        if (!run) return "";
        clearTimeout(run.timer);
        await run.promise;
        if (run.token !== token()) return "";
        run.ticket || (missed = run.error);
        return run.ticket;
      },
      missed: () => missed,
    };
  }
  if (typeof module === "object" && module.exports) module.exports = create;
  else root.GAME_MATCH_REPORT = create;
})(typeof window === "object" ? window : globalThis);
