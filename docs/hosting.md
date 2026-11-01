# 호스팅: Cloudflare(페이지) + Render(게임 서버)

13fps.xyz는 이렇게 나뉘어 돌아갑니다.

| 맡는 곳 | 하는 일 | 코드 |
|---|---|---|
| Cloudflare Workers (무료) | 홈페이지·게임·안내 페이지 파일, `/`·`/admin` 주소, `/api`·`/peerjs` 요청을 Render로 전달 | `wrangler.jsonc`, `cloudflare/worker.mjs`, `_headers`, `.assetsignore` |
| Render (Starter, 싱가포르) | 게임 API(`api/v1.js`)와 우리 PeerJS 연결 서버 | `render.yaml`, `server/render.js` |
| Upstash Redis | 계정·전적·설정 데이터 (그대로) | — |
| Cloudflare Realtime TURN | 직접 연결이 안 되는 플레이어의 중계 (그대로) | — |

- Render 서버는 Cloudflare Worker를 거친 요청만 받습니다. 둘이 같은 비밀 값(`PROXY_SECRET`)을 나눠 갖고, Worker가 접속한 사람의 IP를 함께 넘깁니다. 로그인 횟수 제한 같은 IP별 제한은 그대로 동작합니다.
- 운영자 '게임 설정'의 **우리 연결 서버**(`game.ownPeer`)를 켜면 방 만들기·참가가 우리 PeerJS 서버를 씁니다. 우리 서버가 응답하지 않으면 그 판은 공용 PeerJS 서버로 연결합니다.
- main에 병합하면 Cloudflare와 Render가 각각 자동으로 배포합니다.

## 처음 한 번 하는 설정

### 1. Render
1. Render 대시보드에서 **New → Blueprint**를 누르고 GitHub 저장소 `Sgh1101/DFDF`를 고릅니다. `render.yaml`을 읽어 `dfdf-server`(Starter, 싱가포르)를 만듭니다.
2. 비밀 값을 넣습니다. 채팅이나 다른 곳에 붙이지 마세요.

   | 이름 | 어디서 |
   |---|---|
   | `KV_REST_API_URL`, `KV_REST_API_TOKEN` | Vercel 프로젝트 → Settings → Environment Variables에서 값 보기 |
   | `SESSION_SECRET` | Vercel에 넣었던 원래 값. 없으면 새로 긴 무작위 문자열을 넣습니다. 이 경우 모든 사람이 한 번 다시 로그인합니다. |
   | `ADMIN_MASTER_PASS` | 운영자 페이지 비밀번호 |
   | `OWNER_ID` | 운영자 게임 계정 아이디 |
   | `CF_TURN_KEY_ID`, `CF_TURN_API_TOKEN` | Cloudflare 대시보드 → Realtime → TURN의 키. 토큰은 Vercel에서 다시 볼 수 없으니 새로 만듭니다. |

   `PROXY_SECRET`은 Render가 자동으로 만듭니다.
3. 배포가 끝나면 `https://<서비스 주소>.onrender.com/healthz`가 `ok`를 보여 주는지 확인합니다.

### 2. Cloudflare
1. 대시보드에서 **Workers & Pages → Create → Import a repository**를 누르고 `Sgh1101/DFDF`를 고릅니다. 빌드 명령은 비워 두고, 배포 명령은 `npx wrangler deploy`입니다.
2. Worker의 **Settings → Variables and Secrets**에 Secret `PROXY_SECRET`을 넣습니다. 값은 Render의 같은 이름 값입니다.
3. Render 서비스 주소는 `wrangler.jsonc`의 `SERVER_ORIGIN`에 넣습니다(코드로 반영).
4. `https://dfdf.<계정>.workers.dev`에서 로그인·게임이 되는지 확인합니다.

### 3. 도메인 (마지막, 서비스가 끊기지 않는 순서)
1. Cloudflare에서 **Add a domain → 13fps.xyz → Free**를 고릅니다. 기존 DNS 레코드를 가져오고 네임서버 2개를 알려 줍니다.
   - 가져온 레코드 중 Vercel을 가리키는 A 레코드(`216.198.79.1`, `64.29.17.1`)는 **DNS only(회색 구름)**로 둡니다.
   - 이렇게 하면 다음 단계 동안에도 사이트가 Vercel에서 그대로 열립니다.
2. 호스팅케이알 도메인 관리에서 네임서버를 Cloudflare의 2개로 바꿉니다. Cloudflare에서 도메인이 **Active**가 될 때까지 몇 분에서 몇 시간을 기다립니다.
3. Worker의 **Settings → Domains & Routes → Add → Custom domain**에 `13fps.xyz`를 넣습니다. 기존 A 레코드를 바꾸겠냐고 물으면 바꿉니다. 이때부터 Cloudflare에서 서비스됩니다.

## 주의
- 데이터베이스(Upstash)는 Vercel 통합으로 만들어졌습니다. Vercel 계정이나 그 통합을 지우면 데이터가 같이 지워질 수 있습니다. Vercel 프로젝트는 일시 중지만 하고, 데이터베이스를 따로 옮기기 전까지 통합은 지우지 마세요.
- 홍보 영상은 별도 Vercel 사이트(`13fps-film.vercel.app`)에 있습니다.
