(() => {
  // Draw visible canvas portraits one per idle task, using the final appearance
  // extensions. Hidden selection screens must not hold up the home controls.
  const records = new WeakMap(), queue = new Set();
  let scheduled = false;
  const idle = (callback) => window.requestIdleCallback ? requestIdleCallback(callback, { timeout: 100 }) : setTimeout(callback, 16);
  function schedule() {
    if (scheduled || !queue.size) return;
    scheduled = true;
    GAME_BOOT.ready.then(() => idle(draw));
  }
  function draw() {
    scheduled = false;
    for (const image of queue) {
      queue.delete(image);
      const record = records.get(image);
      if (!record || !record.visible || !image.isConnected || image.closest("[hidden]") || !image.getClientRects().length) continue;
      image.src = agentPortrait(record.agent, record.width, record.height);
      record.drawn = true;
      observer.unobserve(image);
      break;
    }
    schedule();
  }
  const observer = new IntersectionObserver((entries) => {
    for (const entry of entries) {
      const record = records.get(entry.target);
      if (!record) continue;
      record.visible = entry.isIntersecting;
      if (entry.isIntersecting && !record.drawn) {
        if (record.priority) {
          const waiting = [...queue];
          queue.clear(); queue.add(entry.target);
          for (const image of waiting) queue.add(image);
        } else queue.add(entry.target);
      }
    }
    schedule();
  });
  function set(image, agent, width, height, priority = false) {
    if (!image) return;
    records.set(image, { agent, width, height, priority, visible: false, drawn: false });
    observer.unobserve(image);
    observer.observe(image);
  }
  function clear(root) {
    for (const image of root.querySelectorAll("img")) {
      observer.unobserve(image); queue.delete(image); records.delete(image);
    }
  }
  window.GAME_PORTRAITS = { set, clear };
})();
