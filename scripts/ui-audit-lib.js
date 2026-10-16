// Finds layout problems on whatever screen is showing: interactive things that are cut off, covered
// by something else (a click would land elsewhere), too small to hit on a phone, or drawn on top of
// each other, text that spills out of its button, and sideways page scroll.
// Run inside the page: audit(label, { touch }) → [problem, ...]
module.exports.AUDIT_SRC = `(() => {
  const SEL = 'button, a[href], summary, input:not([type=hidden]), select, textarea, [role=button], [onclick], .tt-item, [tabindex]:not([tabindex="-1"])';
  const vis = (e) => {
    for (let n = e; n && n.nodeType === 1; n = n.parentElement) {
      const s = getComputedStyle(n);
      if (s.display === "none" || s.visibility === "hidden" || +s.opacity < 0.05 || n.hidden || n.inert) return false;
      if (s.pointerEvents === "none" && n === e) return false;
    }
    return true;
  };
  const name = (e) => (e.id ? "#" + e.id : "") + (e.className && typeof e.className === "string" ? "." + e.className.trim().split(/\\s+/).slice(0, 2).join(".") : "") || e.tagName.toLowerCase();
  const label = (e) => (e.getAttribute("aria-label") || e.title || e.textContent || e.value || "").trim().replace(/\\s+/g, " ").slice(0, 24);
  // the part of an element that is not clipped by a scrolling/hidden-overflow ancestor
  const shown = (e) => {
    let r = e.getBoundingClientRect(), L = Math.max(0, r.left), T = Math.max(0, r.top), R = Math.min(innerWidth, r.right), B = Math.min(innerHeight, r.bottom);
    let scroller = false;
    for (let n = e.parentElement; n && n !== document.body; n = n.parentElement) {
      const s = getComputedStyle(n);
      if (/(auto|scroll|hidden|clip)/.test(s.overflowX + s.overflowY)) {
        const c = n.getBoundingClientRect();
        if (/(auto|scroll)/.test(s.overflowX + s.overflowY) && (n.scrollHeight > n.clientHeight + 2 || n.scrollWidth > n.clientWidth + 2)) scroller = true;
        L = Math.max(L, c.left); T = Math.max(T, c.top); R = Math.min(R, c.right); B = Math.min(B, c.bottom);
      }
    }
    return { L, T, R, B, w: Math.max(0, R - L), h: Math.max(0, B - T), scroller, r };
  };
  window.__audit = (where, o) => {
    o = o || {};
    const out = [], items = [];
    for (const e of document.querySelectorAll(SEL)) {
      if (!vis(e)) continue;
      const s = shown(e), r = s.r;
      if (r.width < 1 || r.height < 1) continue;
      items.push({ e, s });
    }
    const add = (kind, e, extra) => out.push({ where, kind, el: name(e), text: label(e), ...(extra || {}) });
    for (const { e, s } of items) {
      const r = s.r, full = r.width * r.height;
      const seenArea = s.w * s.h;
      // cut off by the screen edge or a clipping box (and not simply scrollable)
      if (seenArea < full * 0.6 && !s.scroller) add("cut-off", e, { seen: Math.round((seenArea / full) * 100) + "%", rect: [r.left, r.top, r.right, r.bottom].map(Math.round) });
      if (seenArea < 4) continue;
      // would a tap on its middle land on it?
      const x = (s.L + s.R) / 2, y = (s.T + s.B) / 2, hit = document.elementFromPoint(x, y);
      if (hit && hit !== e && !e.contains(hit) && !hit.contains(e)) {
        // a label sitting on its input, or an input over a custom box, is fine
        const lab = e.closest("label"), ok = lab && (lab === hit || lab.contains(hit));
        ok || add("covered", e, { by: name(hit) + " " + label(hit), at: [Math.round(x), Math.round(y)] });
      }
      // too small to hit
      const min = o.touch ? 30 : 18;
      if (seenArea > 4 && (s.w < min || s.h < min) && !/range|checkbox|radio/.test(e.type || "")) add("small", e, { size: Math.round(s.w) + "x" + Math.round(s.h) });
      // text running out of its box
      const cs = getComputedStyle(e);
      if (/(button|summary)/i.test(e.tagName) && e.scrollWidth > e.clientWidth + 3 && cs.overflowX !== "visible" && cs.textOverflow !== "ellipsis") add("text-cut", e, { sw: e.scrollWidth, cw: e.clientWidth });
    }
    // two controls on top of each other
    for (let i = 0; i < items.length; i++) for (let j = i + 1; j < items.length; j++) {
      const a = items[i], b = items[j];
      if (a.e.contains(b.e) || b.e.contains(a.e)) continue;
      const ox = Math.min(a.s.R, b.s.R) - Math.max(a.s.L, b.s.L), oy = Math.min(a.s.B, b.s.B) - Math.max(a.s.T, b.s.T);
      if (ox <= 2 || oy <= 2) continue;
      const small = Math.min(a.s.w * a.s.h, b.s.w * b.s.h);
      if (small > 0 && (ox * oy) / small > 0.25) {
        // only when one really sits over the other (same stacking), not two layers of different screens
        const ca = document.elementFromPoint((Math.max(a.s.L, b.s.L) + Math.min(a.s.R, b.s.R)) / 2, (Math.max(a.s.T, b.s.T) + Math.min(a.s.B, b.s.B)) / 2);
        if (ca && (a.e === ca || a.e.contains(ca) || b.e === ca || b.e.contains(ca)))
          out.push({ where, kind: "overlap", el: name(a.e) + " " + label(a.e), with: name(b.e) + " " + label(b.e), area: Math.round(((ox * oy) / small) * 100) + "%" });
      }
    }
    const de = document.documentElement;
    if (de.scrollWidth > innerWidth + 2 || document.body.scrollWidth > innerWidth + 2) out.push({ where, kind: "page-overflow-x", sw: Math.max(de.scrollWidth, document.body.scrollWidth), vw: innerWidth });
    return out;
  };
})()`;
