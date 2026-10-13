# DFDF

브라우저에서 바로 하는 5대5 공격/수비 전술 FPS입니다. 공격팀은 스파이크를 설치하고, 수비팀은 막거나 해제합니다.

## 게임

- **요원**: 40명, 능력 160개. 요원마다 Q/E/C/X 능력 4개가 있습니다. 요원 목록은 `play.html` 안에서 여러 묶음으로 조합됩니다.
- **멀티플레이**: PeerJS(WebRTC) P2P. 대기실의 빈 자리는 AI 봇으로 채울 수 있습니다.
- **성장**: 계정, 레벨/XP, 골드, 랭크, 미션, 뽑기, 스킨.
- **관리자 페이지**: `admin.html` (`/admin`).
- **PWA**: `manifest.webmanifest`, `sw.js`. Vercel에 배포됩니다.

## 그래픽과 사운드

효과음, 초상화, 일부 텍스처는 코드로 만듭니다. 맵 표면 재질과 하늘 조명은 파일을 씁니다.

- `assets/mat/`: 표면 재질 webp 54개 (색, 노멀, ORM). `play.html`이 `assets/mat/<재질>_<종류>.webp`로 불러옵니다.
- `assets/env/`: 하늘 조명 HDR 7개 (alpine, city, dawn, forest, park, studio, warehouse). `assets/env/<이름>.hdr`로 불러옵니다.
- 출처는 `assets/CREDITS.md`에 있습니다 (CC0).

## 파일

| 파일 | 설명 |
|---|---|
| `play.html` | 게임 본체 (단일 파일) |
| `index.html` | 소개 페이지 |
| `admin.html` | 관리자 페이지 |
| `api/v1.js` | 서버 함수 (`?a=<action>`), 데이터는 Upstash Redis REST |
| `sw.js`, `manifest.webmanifest` | PWA |
| `vercel.json` | 배포 설정 |

## 환경변수 (Vercel)

| 이름 | 용도 |
|---|---|
| `KV_REST_API_URL` / `UPSTASH_REDIS_REST_URL` | Redis 주소 |
| `KV_REST_API_TOKEN` / `UPSTASH_REDIS_REST_TOKEN` | Redis 토큰 |
| `ADMIN_MASTER_PASS` | 관리자 비밀번호 |
| `SESSION_SECRET` | 세션·매치 티켓 서명 키 |

`SESSION_SECRET`이 없으면 관리자 비밀번호와 Redis 토큰에서 만든 값을 대신 씁니다. 그러면 비밀번호를 바꿀 때 기존 티켓이 모두 무효가 되므로, Vercel에 따로 설정해 두세요.
