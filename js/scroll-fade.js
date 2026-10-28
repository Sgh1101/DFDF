(() => {
  // Rows that scroll sideways (the armory's gun list on a phone, its tabs and filter chips) cut their last
  // item at the edge with nothing saying there is more. A row that can still scroll toward a side fades out
  // on that side; css/review-fixes.css draws the fade from these two classes.
  const ROWS = "#ar-guns, #ar-tabs, #mi-f, #sh-f";
  function mark(row) {
    const more = row.scrollWidth - row.clientWidth > 2;
    row.classList.toggle("sfade-l", more && row.scrollLeft > 2);
    row.classList.toggle("sfade-r", more && row.scrollLeft + row.clientWidth < row.scrollWidth - 2);
  }
  let pending = false;
  function markAll() {
    if (pending) return;
    pending = true;
    requestAnimationFrame(() => {
      pending = false;
      for (const row of document.querySelectorAll(ROWS)) mark(row);
    });
  }
  // scroll does not bubble, but a capturing listener on the document sees every element's scroll
  document.addEventListener("scroll", (e) => e.target instanceof Element && e.target.matches(ROWS) && mark(e.target), { capture: true, passive: true });
  addEventListener("resize", markAll);
  const armory = document.getElementById("armory");
  armory && new MutationObserver(markAll).observe(armory, { childList: true, subtree: true, attributes: true, attributeFilter: ["hidden"] });
})();
