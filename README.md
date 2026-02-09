# Gosan Web Go App

브라우저에서 즐기는 1:1 바둑 대국 앱입니다. 방 만들기/초대 코드, 시간제, 계가까지 지원합니다.

## 빠른 시작 (로컬)

1. 의존성 설치

```bash
npm install
```

2. 서버 실행 (Cloudflare Workers 로컬 개발)

```bash
npm run dev -w server
```

3. 웹 앱 실행

```bash
npm run dev -w web
```

4. 브라우저 접속

`http://localhost:5173`

기본 서버 주소는 `http://localhost:8787`입니다.

## 사용 방법

1. **온라인 대국**
   - 닉네임 입력
   - 서버 URL 확인 (`http://localhost:8787` 또는 배포 주소)
   - `방 만들기` 클릭 → 방 코드가 표시됩니다
   - 친구는 방 코드를 입력하고 `입장` 클릭

2. **대국 진행**
   - 착수: 보드를 클릭
   - 패스: `패스` 버튼
   - 기권: `기권` 버튼

3. **계가**
   - `계가 시작` 클릭
   - 죽은 돌을 클릭으로 표시
   - 양측 `계가 동의` 버튼을 눌러 확정

4. **로컬 대국 (AI)**
   - `AI와 대국 시작` 클릭
   - 간단한 랜덤 합법 착수 AI와 대국 가능

## 배포 (무료)

### 1) 서버: Cloudflare Workers (무료)

```bash
npm run deploy -w server
```

배포 후 Workers 주소가 출력됩니다. 예: `https://gosan-server.<account>.workers.dev`

### 2) 웹: Cloudflare Pages (무료)

```bash
npm run build -w web
npx wrangler pages deploy web/dist --project-name gosan-web
```

배포 완료 후 Pages 주소로 접속합니다. 예: `https://gosan-web.pages.dev`

## 주요 기능
- 1:1 온라인 방 (초대 코드)
- 로컬 AI (랜덤 합법 착수)
- 중국식 면적 계가 (죽은 돌 표시 지원)
- 기본 시간제

## 참고
- 서버는 권위(authoritative)이며, 규칙 판정은 서버가 처리합니다.
- 계가는 양측 동의 후 확정됩니다.
