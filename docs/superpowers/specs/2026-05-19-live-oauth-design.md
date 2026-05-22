# 설계: Live 모드 소셜 OAuth (카카오·네이버·구글)

**날짜**: 2026-05-19  
**상태**: 승인됨 (brainstorming §1–§3)  
**범위**: `AUTH_MODE=live` 시 Better Auth 소셜 3종, 모바일 우선 `/auth/sign-in`·`/invite/accept`, 최초 가입 약관, 스태프 **이메일 초대** 수락 연동.

**전제 문서**: [PRD.md](../../PRD.md) §5·§6, [session-handoff-and-status.md](../../session-handoff-and-status.md), [2026-05-15-invite-email-design.md](./2026-05-15-invite-email-design.md), [개발자가-처리할-항목.md](../../개발자가-처리할-항목.md) §1·§2.

**후속 스펙(본 문서 범위 밖)**:

- **SMS·휴대폰 초대·전화번호 매칭** — 상담 시 전화만 적는 패턴 (`invite-sms-phone` 가칭)
- **대기·리드·대시보드 큐** — 당분간 Student 메모·`/communications`·수동 연락

---

## 1. 배경·목표

### 현재

- `AUTH_MODE=live`: Better Auth + Mongo, **`emailAndPassword`만** 활성.
- `AUTH_MODE=mock`: 고정 사용자 세션; 소셜 UI는 세션을 바꾸지 않음.
- 스태프: `AcademyInvite` + SMTP + `/invite/accept` + `/auth/sign-in` 복귀 + **이메일 엄격 일치** 수락.
- 학부모: `ParentStudentLink`로 자녀 연결; `/p` 읽기 포털.
- **학생**: 로그인 역할 없음 (`Student` 레코드만).

### 목표

- PRD §5: **카카오·네이버·구글** 소셜 로그인·가입 (3종 동시).
- **모바일**: 초대·상담 후 폰에서 **터치 최소화** — 소셜 1탭 중심.
- **스태프 초대**: 기존 이메일 초대·SMTP·수락 플로 유지.
- **학부모**: **자유 가입** + 학원이 `ParentStudentLink` (이메일 초대 필수 아님).
- **약관**: 최초 가입 1회 필수.

---

## 2. 합의된 제품 결정

| 항목 | 결정 |
|------|------|
| 소셜 제공자 | **카카오·네이버·구글 동시** (Better Auth 내장) |
| 스태프 초대 수락 | 세션 `user.email` **=** 초대 `email` (정규화 후, **엄격 일치**) |
| 학부모 | `/auth/sign-in` **소셜만** (일반 경로); 연결은 스태프가 `ParentStudentLink` |
| 학부모 이메일 초대 | **비권장**; 플랫폼 `parent` 초대 UI 정리는 **SMS 스펙**에서 |
| 약관 | **최초 가입 1회**; 재로그인·초대 수락 시 스킵 |
| 로그인 UI | **`inviteEmail` 있을 때만** 이메일·비밀번호 보조; 없으면 **소셜만** |
| 이메일·비밀번호 | live에서 **유지** (스태프 초대·로컬 검증); 소셜과 병행 |
| mock | 변경 없음; live 소셜 경로는 mock에서 **비노출** |
| SMS·전화 초대 | **다음 스펙** |
| 대기·리드 대시보드 | **제외** (C) |

---

## 3. 역할별 온보딩

```text
super_admin   시드·플랫폼 수동 멤버십 (AcademyInvite 토큰 대상 아님)

스태프        이메일 초대 → SMTP 링크 → /invite/accept
              → /auth/sign-in (inviteEmail, callbackURL)
              → 카카오·네이버·구글 (primary) 또는 이메일·비밀번호 (보조)
              → 이메일 일치 → 수락 → AcademyMembership

학부모        QR·URL 안내 → /auth/sign-in (소셜만) → 약관(최초)
              → /p (연결 전 안내) → 스태프 ParentStudentLink

학생          계정 없음; Student·Enrollment 등은 스태프가 등록
```

---

## 4. 아키텍처

### 4.1 구성

| 파일·경로 | 책임 |
|-----------|------|
| `src/lib/server/auth.ts` | `socialProviders`: kakao, naver, google; `emailAndPassword.enabled: true` |
| `src/hooks.server.ts` | live: `svelteKitHandler`, `getSession` → `locals.user` |
| `src/lib/auth-client.ts` | `PUBLIC_BETTER_AUTH_URL`, `signIn.social`, `signUp.email` |
| `src/lib/server/invite-return.ts` | `sanitizeInviteCallbackURL` (`pathname === '/invite/accept'`) |
| `src/routes/auth/sign-in/*` | 모바일 소셜 UI, 약관, 초대 시 보조 폼 |
| `src/routes/invite/accept/*` | 토큰·`acceptUi`·`consumeAcademyInviteForLoggedInUser` |

### 4.2 스태프 초대 데이터 흐름

```text
createInvite(email) → AcademyInvite + SMTP
  → /invite/accept?token=
  → need_login → GET /auth/sign-in?callbackURL=&inviteEmail=
  → signIn.social({ callbackURL }) 또는 signUp.email / signIn.email
  → /invite/accept → can_accept → acceptInvite → membership, invite 삭제
```

- 소셜 로그인 성공: Better Auth 클라이언트 `redirectPlugin` → `callbackURL`.
- 이메일 가입 성공: GET form `requestSubmit` → `/invite/accept?token=` (기존).
- 수락: `consumeAcademyInviteForLoggedInUser` — `inv.email === normalize(session.email)`.

### 4.3 약관

- **필드**: `user.termsAcceptedAt` (Better Auth `additionalFields` 또는 동등 메커니즘).
- **signUp.email**: 제출 전 필수 체크.
- **signIn.social 신규 사용자**: OAuth 콜백 후 미동의 시 **1회** 동의 화면.
- 구현 세부(훅 vs 전용 라우트)는 implementation plan에서 확정.

---

## 5. UI (모바일 우선)

### `/auth/sign-in`

- `inviteEmail` 표시(있을 때).
- **Primary**: 카카오 → 네이버 → 구글 (풀폭, 터치 영역 큼).
- `inviteEmail` **있을 때만**: 로그인·가입 탭, 이메일 **readonly**, 비밀번호.
- `inviteEmail` **없을 때**: 소셜만 + “자녀 연결 후 학부모 포털 이용” 안내.
- mock: 기존 amber 안내 블록 유지.

### `/invite/accept`

- `need_login` / `email_mismatch`: **「카카오로 계속」** 문구 강조.
- GET form → `/auth/sign-in` (`callbackURL`, `inviteEmail` hidden).
- `svelte/no-navigation-without-resolve` 준수 (`resolve` + form).

---

## 6. 환경 변수

`.env.example` 추가·정리 (값 커밋 금지):

```env
AUTH_MODE=live

# Better Auth (기존)
BETTER_AUTH_SECRET=
BETTER_AUTH_URL=http://localhost:5173
PUBLIC_BETTER_AUTH_URL=http://localhost:5173

# 소셜 (live, AUTH_MODE=live 일 때)
KAKAO_CLIENT_ID=
KAKAO_CLIENT_SECRET=
NAVER_CLIENT_ID=
NAVER_CLIENT_SECRET=
GOOGLE_CLIENT_ID=
GOOGLE_CLIENT_SECRET=
```

Redirect URI (개발자 체크리스트 §1):

```text
{BETTER_AUTH_URL}/api/auth/callback/kakao
{BETTER_AUTH_URL}/api/auth/callback/naver
{BETTER_AUTH_URL}/api/auth/callback/google
```

카카오·네이버: **이메일** 동의 항목 필수(스태프 초대 일치). **전화번호** scope는 다음 SMS 스펙을 위해 콘솔에서 미리 검토.

---

## 7. 에러·엣지

| 상황 | 처리 |
|------|------|
| 소셜 이메일 ≠ 초대 이메일 | `email_mismatch` + 카카오 계정 이메일 안내 |
| 세션에 이메일 없음 | `no_session_email` + 제공자 scope 안내 |
| OAuth env 미설정 | sign-in에 live 미구성 안내; mock으로 데모 |
| 약관 미동의 | 가입·OAuth 콜백 차단 |
| callbackURL 조작 | `sanitizeInviteCallbackURL` — `/invite/accept` 만 |

---

## 8. 테스트·롤아웃

### 자동

`npm run check` → `npm test` → `npm run lint` → `npm run build`

### 수동

| 시나리오 | 모드 |
|----------|------|
| mock 회귀 | `AUTH_MODE=mock` |
| 소셜 로그인 3종 | live + 키 |
| 초대 → 카카오 → 수락 | live |
| 학부모 소셜 가입 → `/p` 연결 대기 | live |
| `inviteEmail` 없음 → 소셜만 UI | live |

### 롤아웃

1. 로컬 live + 3종 키  
2. 스테이징 Redirect URI  
3. 프로덕션: 체크리스트 §1·§2 후  

SMTP 초대와 **독립** 배포 가능.

---

## 9. 문서·후속

| 문서 | 작업 |
|------|------|
| `docs/개발자가-처리할-항목.md` | §1 env 이름·Redirect URI 예시 동기화 |
| `docs/inferred-decisions-log.md` | 본 설계 요약 1항목 |
| `docs/session-handoff-and-status.md` §0 | live OAuth 한 줄 (구현 후) |

**구현 접근**: Better Auth 내장 `socialProviders` (generic OAuth 커스텀·소셜 전용 제거는 채택하지 않음).

**다음 스펙**: SMS·`AcademyInvite.phone`(또는 동등)·전화 매칭·상담 데스크 발송 — OAuth와 Redirect·scope만 막지 않도록 본 설계에서 전제.

---

## 10. 비채택

- 소셜만(이메일·비밀번호 제거) — 초대·로컬 검증 불리.
- 학부모·스태프 동일 초대 규칙(전화 없이 이메일만) — 상담 현장과 불일치.
- 초대 수락 시 이메일 검증 생략 — 보안·오발급 리스크.
- 본 스펙에 SMS·대기 큐 포함 — 범위 초과 (B·C로 분리).
