// The shared frame of the article pages: head tags, the header navigation, the footer with the "게임 시작" button.
// Every page of the site except the game, the home page and the owner page is written through page().
const ORIGIN = "https://13fps.xyz";
// [file, label, key]: the header navigation; the footer repeats the same links and adds the privacy policy
const NAV = [
  ["guide.html", "게임 소개", "guide"],
  ["controls.html", "조작법", "controls"],
  ["modes.html", "모드", "modes"],
  ["maps.html", "맵", "maps"],
  ["agents.html", "요원", "agents"],
  ["patch-notes.html", "패치노트", "patch"],
  ["about.html", "소개", "about"],
  ["contact.html", "문의", "contact"],
];
const esc = (s) => String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
const attr = (s) => esc(s).replace(/'/g, "&#39;");

function page(p) {
  const url = `${ORIGIN}/${p.file}`, full = `${p.title} | 13`;
  const nav = NAV.map(([f, label, key]) => `<a href="./${f}"${p.nav === key ? ' aria-current="page"' : ""}>${label}</a>`).join("");
  const links = NAV.concat([["privacy.html", "개인정보처리방침", "privacy"]]).map(([f, label]) => `<a href="./${f}">${label}</a>`).join("");
  return `<!doctype html>
<!-- written by scripts/build-site-pages.js: change the page in scripts/site-pages/, not here -->
<html lang="ko">
<head>
<meta charset="utf-8">
<title>${esc(full)}</title>
<meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover">
<meta name="theme-color" content="#0a0d12">
<meta name="description" content="${attr(p.description)}">
<link rel="canonical" href="${url}">
<meta property="og:site_name" content="13">
<meta property="og:type" content="website">
<meta property="og:locale" content="ko_KR">
<meta property="og:title" content="${attr(full)}">
<meta property="og:description" content="${attr(p.description)}">
<meta property="og:url" content="${url}">
<meta property="og:image" content="${ORIGIN}/icons/icon-512.png">
<meta name="twitter:card" content="summary">
<link rel="manifest" href="/manifest.webmanifest">
<link rel="icon" type="image/png" sizes="192x192" href="/icons/icon-192.png">
<link rel="apple-touch-icon" href="/icons/icon-192.png">
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Jua&family=Gowun+Dodum&display=swap">
<link rel="stylesheet" href="./css/pages.css">
</head>
<body>
<a class="skip" href="#main">본문으로 건너뛰기</a>
<header class="sh"><div class="wrap sh-in">
<a class="sh-logo" href="./index.html" aria-label="13 첫 화면">13</a>
<nav class="sh-nav" aria-label="사이트 메뉴">${nav}</nav>
<a class="btn go sh-play" href="./play.html">게임 시작</a>
</div></header>
<main id="main" class="wrap">
<article class="page${p.wide ? " wide" : ""}">
<h1>${p.h1}</h1>
${p.lead ? `<p class="lead">${p.lead}</p>` : ""}
${p.body}
</article>
</main>
<footer class="sf"><div class="wrap">
<div class="sf-cta"><p><strong>설치 없이 지금 바로</strong>브라우저에서 한 판 해 보세요. 혼자서는 AI와, 친구와는 초대 코드로 함께 즐길 수 있습니다.</p><a class="btn go" href="./play.html">게임 시작</a></div>
<nav class="sf-links" aria-label="바닥 메뉴">${links}</nav>
<small>13은 브라우저에서 하는 5대5 전술 FPS입니다. 이 사이트는 개인이 만들고 운영합니다.</small>
</div></footer>
${p.scripts || ""}</body>
</html>
`;
}
module.exports = { page, NAV, ORIGIN, esc, attr };
