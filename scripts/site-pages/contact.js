module.exports = {
  file: "contact.html", nav: "contact", lastmod: "2026-10-31",
  title: "문의하기",
  description: "13에 대한 문의, 버그 신고, 제안, 후기, 개인정보 삭제 요청을 보내는 곳입니다. 로그인하지 않아도 보낼 수 있고, 답변은 같은 기기에서 다시 확인할 수 있습니다.",
  h1: "문의하기",
  lead: "궁금한 점, 고장 난 곳, 바라는 점을 알려 주세요. 로그인하지 않아도 보낼 수 있습니다. 개인이 운영하는 게임이라 답변까지 시간이 걸릴 수 있지만 모든 글을 직접 읽습니다.",
  scripts: `<script src="./js/client-request.js"></script>\n<script src="./js/contact-page.js"></script>\n`,
  body: `
<p id="contactMail" class="note" hidden>이메일로도 문의할 수 있습니다: <a id="contactMailLink" href="#"></a></p>

<form class="form" id="contactForm" novalidate>
<label for="cType">종류</label>
<select class="in" id="cType" name="type">
<option value="ask">문의</option>
<option value="bug">버그 신고</option>
<option value="idea">제안 (바라는 점)</option>
<option value="review">후기</option>
<option value="report">사용자 신고</option>
<option value="other">기타 (계정 삭제 · 개인정보 요청 포함)</option>
</select>
<div id="cReportBox" hidden>
<label for="cTarget">신고할 사용자의 이름</label>
<input class="in" id="cTarget" maxlength="30" autocomplete="off">
</div>
<label for="cTitle">제목 (선택)</label>
<input class="in" id="cTitle" maxlength="60" autocomplete="off">
<label for="cText">내용</label>
<textarea class="in" id="cText" maxlength="2000" required aria-describedby="cTextHint"></textarea>
<p class="hint" id="cTextHint"><span id="cCount">0</span> / 2000자 · 5자 이상 적어 주세요. 버그라면 어느 모드와 맵에서, 어떤 기기와 브라우저로 했는지, 어떻게 하면 다시 나타나는지를 함께 적어 주세요.</p>
<label for="cContact">답장 받을 연락처 (선택)</label>
<input class="in" id="cContact" maxlength="80" autocomplete="off">
<p class="hint">적지 않아도 됩니다. 답변은 이 페이지 아래 "내가 보낸 문의"에 올라옵니다. 연락처는 답장에만 쓰고 최대 90일 뒤에 함께 지워집니다.</p>
<div class="row"><button class="btn go" id="cSend" type="submit">보내기</button><span class="hint" id="cWho"></span></div>
<div class="msg" id="cMsg" role="status" aria-live="polite" hidden></div>
<noscript><p class="msg err">문의 양식은 자바스크립트가 필요합니다. 켤 수 없다면 게임 첫 화면의 "문의 · 제안" 버튼을 이용해 주세요.</p></noscript>
</form>

<section id="mineBox" hidden>
<h2>내가 보낸 문의</h2>
<p>이 기기에서 보낸 최근 글입니다. 운영자가 답변을 달면 여기에 나타납니다. 로그인한 계정으로 보낸 글은 같은 계정으로 들어오면 어느 기기에서든 볼 수 있습니다.</p>
<ul class="sent" id="mineList"></ul>
</section>

<h2>답변은 어디에서 보나요</h2>
<p>글을 보내면 접수되었다는 안내와 접수 번호가 바로 나옵니다. 운영자가 읽으면 상태가 "확인함", "처리 중", "완료" 등으로 바뀌고, 답변이 있으면 글 아래에 표시됩니다. 이 페이지의 "내가 보낸 문의" 목록이나 게임 첫 화면 위쪽의 "문의 · 제안" 버튼 안에서 같은 목록을 볼 수 있습니다. 게스트로 보냈다면 같은 기기와 같은 브라우저에서 다시 들어와야 답변을 볼 수 있으니, 답변이 꼭 필요하면 계정을 만들거나 연락처를 남겨 주세요.</p>

<h2>자주 보내 주시는 내용</h2>
<h3>버그 신고</h3>
<p>무엇을 하다가 어떤 일이 생겼는지, 모드와 맵, 기기(컴퓨터·스마트폰 기종)와 브라우저를 적어 주세요. 연결이 끊기는 문제는 온라인 방에서 일어난 시각과 방 코드가 도움이 됩니다.</p>
<h3>사용자 신고</h3>
<p>치트로 의심되는 행동, 욕설, 일부러 팀을 방해하는 행동을 알릴 수 있습니다. 신고할 사용자의 이름과 방 코드, 어떤 일이 있었는지를 적어 주세요. 운영자가 확인해 필요하면 접속을 제한합니다.</p>
<h3>계정 삭제와 개인정보 요청</h3>
<p>종류에서 "기타"를 고르고 삭제하고 싶은 계정의 아이디를 적어 주세요. 비밀번호는 절대 적지 마세요. 처리 방법은 <a href="./privacy.html#delete">개인정보처리방침</a>에 있습니다.</p>
<h3>요원·맵·모드 제안</h3>
<p>새 능력이나 바꾸고 싶은 점을 자유롭게 적어 주세요. 요원 제안은 게임 안의 "문의 · 제안" 창에 이름과 능력 네 가지를 적는 전용 양식이 있습니다.</p>
`,
};
