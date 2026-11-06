(function (root) {
  'use strict';
  // Named moments of the game that a module adds its own work to, instead of taking the game's global function, wrapping
  // it and putting the wrapper back (the pattern js/legacy/ grew on: 429 such reassignments of 143 functions by
  // 2026-11-07, which made the order of play.html the only record of what runs when). The engine calls
  // GAME_HOOKS.run(name, ...) at the moment; modules call GAME_HOOKS.on(name, fn) once, when they load. The work runs in
  // the order the modules registered it (the load order), each in its own try so one failing module cannot stop the rest.
  //   netShutdown  at the start of netShutdown(), while NET still says what the room was (mode, conns): a module clears
  //                what it kept for that room
  const lists = new Map();
  const api = {
    on(name, fn) {
      if (typeof fn !== 'function') throw new TypeError('GAME_HOOKS.on(' + name + '): not a function');
      (lists.get(name) || lists.set(name, []).get(name)).push(fn);
      return fn;
    },
    run(name, ...args) {
      const list = lists.get(name);
      if (!list) return;
      for (const fn of list.slice()) {
        try { fn(...args); } catch (e) { try { console.warn('GAME_HOOKS ' + name, e); } catch (x) {} }
      }
    },
    count: (name) => (lists.get(name) || []).length,
  };
  if (typeof module === 'object' && module.exports) module.exports = api; else root.GAME_HOOKS = api;
})(globalThis);
