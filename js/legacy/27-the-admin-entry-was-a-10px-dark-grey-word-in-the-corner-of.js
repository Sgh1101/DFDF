
(() => {
  // The admin entry was a 10px dark-grey word in the corner of the settings
  // card and nobody could find it. Make it a real tab next to the others;
  // it opens the password screen (the tab itself stays unlit).
  const tabs = document.querySelector("#pause .pz-tabs"),
    link = document.getElementById("pz-admin");
  if (!tabs || !link) return;
  const b = document.createElement("button");
  b.type = "button";
  b.className = "pz-adtab";
  b.id = "pz-adtab";
  b.innerHTML = '<span aria-hidden="true">🔒</span>관리자';
  b.onclick = (e) => {
    e.stopPropagation();
    link.click();
  };
  tabs.appendChild(b);
  const paint = () => {
    const on = typeof ADMIN_UNLOCKED !== "undefined" && ADMIN_UNLOCKED;
    b.firstChild.textContent = on ? "🔓" : "🔒";
    b.classList.toggle("unl", !!on);
  };
  paint();
  setInterval(paint, 1000);
  const st = document.createElement("style");
  st.textContent = `
#pause .pz-admin-link,#pause.from-menu .pz-admin-link{display:none!important}
#pause .pz-tabs .pz-adtab{flex:0 0 auto;display:inline-flex;align-items:center;gap:5px;padding:9px 12px;color:var(--gold,#ffc849);border:1px solid color-mix(in srgb,var(--gold,#ffc849) 35%,transparent);background:rgba(255,200,73,.06)}
#pause .pz-tabs .pz-adtab:hover{background:rgba(255,200,73,.14);color:#fff}
#pause .pz-tabs .pz-adtab span{font-size:11px}
#pause .pz-tabs .pz-adtab.unl{background:rgba(255,200,73,.16)}
@media (max-width:600px){#pause .pz-tabs{flex-wrap:wrap}#pause .pz-tabs button{flex:1 1 30%}#pause .pz-tabs .pz-adtab{flex:1 1 30%;justify-content:center}}
@media (max-height:560px){#pause .pz-tabs .pz-adtab{padding:6px 10px}}`;
  document.head.appendChild(st);
})();
