(() => {
  // Chrome's own Ctrl shortcuts (Ctrl+D bookmark, Ctrl+A select all, Ctrl+S, Ctrl+F …) open a page or dialog that takes the
  // key-up with it, so A and D stayed "held" and the player ran on by itself. In a match: a Ctrl (or Cmd) combination is
  // blocked from the browser and never reaches the game as a key, Ctrl itself is not a game key (crouch is Shift), and
  // whenever the window loses focus, or the pointer is let go, every held key is let go too.
  if ("undefined" == typeof keys || "undefined" == typeof world) return;
  const editing = (t) => !!(t && (t.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(t.tagName)));
  const playing = () => world.phase && "menu" !== world.phase;
  // the zoom keys stay the browser's own
  const keep = (k) => ["+", "-", "=", "0", "_"].includes(k);
  addEventListener(
    "keydown",
    (e) => {
      if (!playing() || editing(e.target)) return;
      if ("Control" === e.key || "Meta" === e.key) return void e.stopImmediatePropagation();
      if ((e.ctrlKey || e.metaKey) && !e.altKey && !keep(e.key)) {
        e.preventDefault();
        e.stopImmediatePropagation();
        // the keys this combination might have started are not held
        keys[(e.key || "").toLowerCase()] = !1;
      }
    },
    !0,
  );
  // a key-up the page never saw (a dialog took it) must not leave the key held
  const letGo = () => {
    for (const k of Object.keys(keys)) "control" !== k && (keys[k] = !1);
    keys.space = !1;
  };
  addEventListener("blur", letGo);
  addEventListener("visibilitychange", () => document.hidden && letGo());
  addEventListener(
    "keyup",
    (e) => {
      // the Meta key swallows the key-ups of the keys pressed under it
      "Meta" === e.key && letGo();
    },
    !0,
  );
  document.addEventListener("pointerlockchange", () => document.pointerLockElement || letGo());
  window.KEY_GUARD = { letGo };
})();
