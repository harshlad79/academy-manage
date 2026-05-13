# 멀티에이전트·병렬 작업 히스토리 (실수 방지)

PRD [§13 멀티에이전트 분배](PRD.md)처럼 도메인을 나눌 때, 과거에 겪은 **빌드·린트·HTML** 문제를 여기에 남긴다.  
신규 작업 전 [`multi-agent.md`](multi-agent.md) · [`multi-agent-lessons.md`](multi-agent-lessons.md) 를 함께 참조하면 동일 이슈를 줄일 수 있다.

## 빠른 링크

- **Git·서브·검증 원칙(루트):** [AGENTS.md](../AGENTS.md)
- **절차·트랙 분할**: [`multi-agent.md`](multi-agent.md)
- **실수 히스토리**: 아래 이슈 기록

## 이슈 기록 (최신在上 — 아래로 갈수록 이전)

### 2026-05-13 — live 플랫폼 멤버 추가 시 userId 존재 검증

- **맥락**: `AUTH_MODE=live` 에서 플랫폼이 멤버십만 만들고 Better Auth 계정이 없으면 고아 멤버십.
- **조치**: `liveBetterAuthUserExists` → `academy-db` 의 `user` 컬렉션에서 `id` / `userId` 조회. **mock 은 검증 생략**(목업 ID 자유).

### 2026-05-11 — 비활성 학원: 학부모 포털 컨텍스트 vs 스태프 업무

- **맥락**: 학원이 `inactive`일 때 학부모는 자료 열람이 필요하고, 출결·수납 등 **스태프 업무**는 막아야 함.
- **조치**: `academyAllowsResolvedContext`(쿠키·해석·전환·스위처)와 `academyAllowsStaffContext`(업무 전용 의미 유지)를 분리. `/p`에는 `academyOperationalStatus`로 비활성 안내 배너.

### 2026-05-13 — 비활성 학원·`super_admin` 전용 스코프

- **맥락**: 다학원에서 학원을 비활성화한 뒤에도 일반 스태프가 쿠키로 그 학원에 남아 있으면 안 됨.
- **조치**: `resolveActiveAcademyContext` / `buildAcademySwitcherData` / `setActiveAcademy` 는 **`academyAllowsResolvedContext`**(학부모는 비활성 허용)로 폴백. **스태프 전용 제한**은 `academyAllowsStaffContext` 로 별도 판단 가능. 플랫폼 멤버 화면은 `src/routes/platform/academies/[academyId]/members/*` 로 분리.

### 2026-05-13 — SvelteKit `+layout.server.ts` 에는 `actions` 불가

- **현상**: `export const actions` 를 루트 `+layout.server.ts` 에 두면 빌드 시 `Invalid export 'actions'` .
- **조치**: 전역에서 쓰는 폼 액션은 **`+page.server.ts`**(예: `/` 대시보드)로 옮기고, `action={\`${resolve('/')}?/actionName\`}` 로 POST.

### 2026-05-12 — 다학원 1단계: 트랙 분리(모델·시드 vs RBAC·플랫폼 라우트)

- **맥락**: `Academy` 도입 + `/platform` 을 안전하게 추가할 때 병렬 에이전트로 나눌 경우.
- **조치**: **`src/lib/server/models/academy.ts` + `scripts/seed.ts`** 한 트랙, **`rbac.ts` + `src/routes/platform/**`** 다른 트랙으로 나누면 충돌이 적음. **`.env.example`\*\* 문구는 한쪽에서만 수정.

### 2026-05-12 — ESLint `svelte/no-navigation-without-resolve` 와 쿼리스트링

- **현상**: `href={\`${resolve('/path')}?month=...\`}` 가 **내부 링크에 resolve가 없다**고 실패.
- **원인**: 규칙이 템플릿 리터럴 안의 `resolve()` 를 인정하지 않거나, `href` 에 **문자열 조합**만 있으면 실패하는 경우가 있음.
- **조치**: 쿼리가 필요하면 `<form method="GET" action={resolve('/path')}>` + `hidden` 필드로 전달(형제 폼으로 배치).
- **금지**: **`<form>` 안에 `<form>` 중첩** — 월 필터 폼 + CSV 폼을 한 부모 안에 넣지 말고, 래퍼 `div` 로 **형제** 두 폼으로 분리.

### 2026-05-12 — `$env/static/public` 과 선택적 `PUBLIC_*` 변수

- **현상**: 로컬/CI `.env` 에 키가 없으면 Vite 빌드 시 `MISSING_EXPORT` (`PUBLIC_ACADEMY_DISPLAY_NAME` 등).
- **조치**: **필수가 아닌** 공개 변수는 서버 로드에서 **`import { env } from '$env/dynamic/public'`** 로 읽기.  
  `app.d.ts` 에 static public 보강만으로는 빌드 타입 번들이 해결되지 않을 수 있음.

### 2026-05-12 — Vitest `npm test` 와 중복 `--run`

- **현상**: `npm test -- --run` 시 `"Expected a single value for option --run"` .
- **원인**: 이 프로젝트의 `test` 스크립트가 이미 `vitest --run` 을 포함.
- **조치**: 검증은 **`npm test`** 단독. 단일 파일만 돌릴 때는 `npx vitest run path/to/file.test.ts` .

### 2026-05-12 — 오픈뱅킹 스텁 행 → `BankDeposit` 서버 검증

- **맥락**: 미리보기 표에서 버튼으로 미매칭 입금을 등록할 때, 클라이언트만 신뢰하면 **위조 요청** 가능.
- **조치**: 액션에서 `fetchOpenBankingStubTransactions` 를 **동일 월 범위로 재계산**한 뒤, 제출값이 스텁 목록의 한 행과 일치할 때만 `BankDeposit` 생성. `externalRef` 중복은 `BankDeposit.exists` 등으로 차단.

### 2026-05-12 — 병렬 에이전트와 공유 파일

- **현상**: 서로 다른 트랙이 동시에 `.env.example` · `rbac.ts` · 레이아웃을 수정하면 머지 충돌.
- **조치**: 병렬 트랙마다 **편집 디렉터리를 고정**하고, 공용 파일은 **한 트랙만** 수정하거나 마지막에 통합 담당이 한 번에 패치.

### 2026-05-12 — Cursor CLI / worktree (참고)

- **파일 충돌**: `agent --worktree` 로 작업 디렉터리를 나누면 로컬 편집 충돌 완화.
- **여전히 공유**: 동일 MongoDB·동일 dev 포트는 스텝/설정으로 분리 필요.

---

## 트랙 분할 예시 (이 저장소)

| 트랙        | 디렉터리 예시                                        | 비고                                        |
| ----------- | ---------------------------------------------------- | ------------------------------------------- |
| F 청구·수납 | `src/routes/payments/*`, `models/bank-deposit`       | 스태프만                                    |
| H 리포트    | `src/routes/reports/**`, `src/lib/server/reports/**` | CSV·집계                                    |
| C 학부모    | `src/routes/p/*`                                     | 읽기 중심                                   |
| 은행 스텁   | `src/lib/server/banking/*`                           | 환경변수와 연동 시 `.env.example` 충돌 주의 |

---

## 검증 순서 (병합 후)

`npm run check` → `npm test` → `npm run lint` → `npm run build`
