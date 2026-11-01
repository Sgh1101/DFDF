# 호스팅: Cloudflare Workers

13fps.xyz는 Cloudflare Workers 하나에서 돌아갑니다.

| 맡는 것 | 어디서 | 코드 |
|---|---|---|
| 홈페이지·게임·안내 페이지 파일 | Cloudflare 정적 파일 (Worker를 거치지 않음, 무료) | `wrangler.jsonc`, `_headers`, `.assetsignore` |
| `/`, `/admin` 주소, 게임 API(`/api/v1`, `/api/release`) | Worker (`cloudflare/worker.mjs`가 `api/v1.js`를 그대로 실행) | `cloudflare/worker.mjs` |
| 계정·전적·설정 데이터 | Upstash Redis (그대로) | — |
| 직접 연결이 안 되는 플레이어의 중계 | Cloudflare Realtime TURN (그대로) | — |
| 멀티플레이 연결(시그널링) | PeerJS 공용 서버 (그대로) | — |

- **요금제:** 로그인할 때 비밀번호 확인(scrypt)에 CPU를 약 35ms 쓰는데, Workers 무료 요금제 한도는 요청당 10ms입니다. 그래서 **Workers Paid(월 $5)**가 필요합니다. 정적 파일 요청은 Worker를 거치지 않아 요금에 들어가지 않습니다.
- **접속 IP:** API는 Cloudflare가 붙이는 `CF-Connecting-IP`로 접속한 사람의 IP를 읽습니다. 그래서 로그인 횟수 제한 같은 IP별 제한이 그대로 동작합니다.
- **자동 배포:** main에 병합하면 Cloudflare가 자동으로 배포합니다(`npm run deploy`).
- **주소:** 지금 주소를 그대로 씁니다. `/about.html`이 `/about`으로 바뀌지 않고, 보안 헤더도 Vercel 때와 같습니다(`_headers`). 저장소 안의 서버 코드·테스트·문서는 공개되지 않습니다(`.assetsignore`).
- **테스트:** `npm test`(`tests/cloudflare-worker.test.js`), `npm run test:cloudflare`(wrangler dev로 실제 Cloudflare 실행 환경을 띄우고 브라우저로 확인)

## 처음 한 번 하는 설정

### 1. Workers Paid 구독
Cloudflare 대시보드 → **Workers & Pages → Plans**에서 Workers Paid를 고릅니다.

### 2. 저장소 연결
1. **Workers & Pages → Create → Import a repository**를 누르고 `Sgh1101/DFDF`를 고릅니다.
2. 이름은 `dfdf`입니다(`wrangler.jsonc`와 같아야 합니다).
3. 빌드 명령은 비워 두고, 배포 명령에 `npm run deploy`를 넣습니다.

### 3. 비밀 값
Worker의 **Settings → Variables and Secrets**에 아래 값을 **Secret**으로 넣습니다. 채팅이나 다른 곳에 붙이지 마세요.

| 이름 | 어디서 |
|---|---|
| `KV_REST_API_URL`, `KV_REST_API_TOKEN` | Vercel 프로젝트 → Settings → Environment Variables에서 값을 볼 수 있습니다. |
| `SESSION_SECRET` | Vercel에 넣었던 원래 값입니다(Vercel에서 다시 볼 수 없습니다). 없으면 새로 긴 무작위 문자열을 넣습니다. 이 경우 모든 사람이 한 번 다시 로그인합니다. |
| `ADMIN_MASTER_PASS` | 운영자 페이지 비밀번호 |
| `OWNER_ID` | 운영자 게임 계정 아이디 |
| `CF_TURN_KEY_ID`, `CF_TURN_API_TOKEN` | Cloudflare 대시보드 → Realtime → TURN의 키. 토큰은 Vercel에서 다시 볼 수 없으니 새로 만듭니다. |

넣은 뒤 **Deployments**에서 다시 배포합니다.

### 4. 임시 주소에서 확인
`https://dfdf.<계정>.workers.dev`에서 로그인·게임·운영자 페이지가 되는지 확인합니다.

### 5. 도메인 (마지막, 서비스가 끊기지 않는 순서)
1. Cloudflare에서 **Add a domain → 13fps.xyz → Free**를 고릅니다. 기존 DNS 레코드를 가져오고 네임서버 2개를 알려 줍니다.
   - 가져온 레코드 중 Vercel을 가리키는 A 레코드(`216.198.79.1`, `64.29.17.1`)는 **DNS only(회색 구름)**로 둡니다.
   - 이렇게 하면 다음 단계 동안에도 사이트가 Vercel에서 그대로 열립니다.
2. 호스팅케이알 도메인 관리에서 네임서버를 Cloudflare의 2개로 바꿉니다. Cloudflare에서 도메인이 **Active**가 될 때까지 몇 분에서 몇 시간을 기다립니다.
3. Worker의 **Settings → Domains & Routes → Add → Custom domain**에 `13fps.xyz`를 넣습니다. 기존 A 레코드를 바꾸겠냐고 물으면 바꿉니다. 이때부터 Cloudflare에서 서비스됩니다.

## 주의
- **데이터베이스:** Upstash는 Vercel 통합으로 만들어졌습니다. Vercel 계정이나 그 통합을 지우면 데이터가 같이 지워질 수 있습니다. 데이터베이스를 따로 옮기기 전까지 Vercel은 사이트 프로젝트만 정리하고, 통합은 지우지 마세요.
- **되돌리기:** 넘긴 뒤 일주일은 Vercel 프로젝트를 그대로 둡니다. 문제가 생기면 Cloudflare DNS에서 13fps.xyz를 다시 Vercel A 레코드로 돌리면 됩니다.
- **홍보 영상:** 별도 Vercel 사이트(`13fps-film.vercel.app`)에 있습니다.
- **나중 일:** 우리 PeerJS 서버(Render) 작업은 `claude/cloudflare-render` 브랜치에 보류해 두었습니다.
