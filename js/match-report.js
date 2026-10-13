(function (root) {
  function create({ request, token, onError = () => {} }) {
    let current = null;
    return {
      begin(fresh = false) {
        if (!token()) return null;
        if (current && !fresh) return current;
        const run = { token: token(), ticket: "" };
        current = run;
        run.promise = request(run.token).then((result) => run.ticket = result.ticket || "").catch(onError);
        return run;
      },
      async finish() {
        const run = current; current = null;
        if (!run) return "";
        await run.promise;
        return run.token === token() ? run.ticket : "";
      },
    };
  }
  if (typeof module === "object" && module.exports) module.exports = create;
  else root.GAME_MATCH_REPORT = create;
})(typeof window === "object" ? window : globalThis);
