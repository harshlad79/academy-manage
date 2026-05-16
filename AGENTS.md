# academy-manage — 에이전트 운영 지침

IDE·Cursor CLI 에이전트가 이 저장소에서 작업할 때의 **기본 원칙**이다.  
(`~/.cursor/cli-config.json`에는 커밋 주기·서브 강제 같은 워크플로 키가 없으므로, 되돌리기·감사는 **Git**을 기준으로 한다.)

## Git

- **논리 단위**(한 이슈·한 기능 슬라이스)마다 작업 후 `git add` → `git commit`까지 끊고, 다른 주제로 넘어간다.
- 커밋 메시지: 무엇을·왜 한 줄 요약; 필요 시 본문.
- **병렬 서브**가 같은 브랜치에서 동시에 `commit`하지 않는다. 커밋·머지는 **한 트랙**(부모 또는 지정 담당)이 순차 처리한다.

## 통신 톤 (caveman + `[CRITICAL]`)

- **기본**: 이 저장소에서 에이전트가 **사용자에게 주는 답**과 **서브에이전트에게 보내는 요청·브리프**, 서브가 **완료 보고**할 때 모두 동일 — 본문은 **caveman**: 짧게, 동사·경로·결과 중심, 군더더기·장문 최소화.
- **크리티컬**(생략·요약·의역 금지): 파일·디렉터리 **전체 경로**, API·타입·함수 **정확한 문자열**(시그니처·원문), 에러·스택 **원문**, git 커밋 해시·브랜치명, 금지 편집 범위, 보안·법적·사용자 인용문 등 — 반드시 **`[CRITICAL]`** 로 감싼 블록(펜스) 안에 **전부** 둔다. 블록 밖에서 “요약하면 …”로 대체하지 않는다(필요 시 블록 + caveman 한 줄 해석만 병기).
- **`[CRITICAL]`** 안 내용은 서브가 **그대로** 실행·인용한다(의역·재정렬로 의미 변경 금지). 변경 파일 목록은 크리티컬이면 펜스 안에 풀 패스 나열.
- 사용자 언어가 한국어면 caveman도 **한국어** 짧은체로 유지한다.

## 서브에이전트·멀티에이전트

- 쪼갤 수 있으면 **Task(서브)**에 위임한다. 부모는 브리프·충돌 경로·검증만 맡긴다.
- 서브 브리프: 위 **통신 톤**과 [docs/multi-agent.md](docs/multi-agent.md) **서브 브리프 템플릿** — 목표 한 줄 + caveman 본문 + **`[CRITICAL]`** 전문. 완료 시 **변경 파일 전체 경로 목록**은 누락 없이(크리티컬 펜스 안 권장).
- 경로 분배·공유 파일 단일 담당·병합 후 검증: [docs/multi-agent.md](docs/multi-agent.md), 실수 방지: [docs/multi-agent-lessons.md](docs/multi-agent-lessons.md).

## 검증

- 머지 또는 단위 완료 후: `npm run check` → `npm test` → `npm run lint` → `npm run build`.

## CLI

- `git commit` / `git add` / `git status` / `git diff` 등이 `~/.cursor/cli-config.json`의 `permissions.allow`에 없으면 에이전트가 커밋하지 못한다. 필요 시 패턴을 추가한다.

## 파일 이름

- Cursor 등에서 관례적으로 쓰는 표준 파일명은 **`AGENTS.md`**(복수)이다. 이 저장소의 에이전트 운영 원칙 단일 원본도 **`AGENTS.md`** 로 둔다.

## Cursor Cloud specific instructions

### 서비스 구성

| 서비스 | 포트 | 필수 | 비고 |
|--------|------|------|------|
| SvelteKit (Vite) | 5173 | 필수 | `npm run dev` |
| MongoDB | 27017 | 필수 | `mongod --fork --logpath /tmp/mongod.log --dbpath /data/db` |

### 개발 서버 실행 순서

1. MongoDB 기동: `mongod --fork --logpath /tmp/mongod.log --dbpath /data/db`
2. `.env` 없으면: `cp .env.example .env` (기본 `AUTH_MODE=mock`)
3. 시드: `npm run seed` — 단, `scripts/seed.ts` 151행에 디스트럭처링 버그 있음 (`enb[0]._id` → `enb._id`). 에러 나면 메인 학원 데이터는 이미 삽입되어 있으므로 멤버십만 수동 보완 필요.
4. `npm run dev`

### 검증 커맨드

README 참조: `npm run check` → `npm test` → `npm run lint` → `npm run build`

### 인증 모드

- `AUTH_MODE=mock`: OAuth 없이 고정 사용자(`testuser`)로 자동 로그인. 개발·테스트용.
- `AUTH_MODE=live`: Better Auth + 소셜 로그인(카카오·네이버·구글). OAuth 시크릿 필요.
- mock 모드 사용자 전환: `.env`의 `AUTH_MOCK_USER_ID` 값 변경 (`testuser`, `superadmin`, `parent-kim`).
