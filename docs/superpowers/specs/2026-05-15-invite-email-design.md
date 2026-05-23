# 설계: 플랫폼 AcademyInvite 이메일 발송 (네이버 SMTP)

**날짜**: 2026-05-15  
**상태**: 승인됨 (brainstorming)  
**범위**: 초대 생성·재발송 시 수락 링크 메일 발송. 비가입자 가입 복귀·발송 큐는 제외.

**전제 문서**: [session-handoff-and-status.md](../../session-handoff-and-status.md) §0·§4, [inferred-decisions-log.md](../../inferred-decisions-log.md), [PRD.md](../../PRD.md).

---

## 1. 배경·목표

### 현재

- `createInvite`는 `AcademyInvite`만 DB에 저장한다.
- 플랫폼 `/platform/academies/[academyId]/members`에서 수락 URL을 **수동 복사**한다.
- `/invite/accept` + `consumeAcademyInviteForLoggedInUser`로 수락·멤버십 생성은 구현됨.

### 목표

- 초대 생성 직후(설정 시) **네이버 SMTP**로 초대 메일 자동 발송.
- 발송 실패 시에도 초대는 유지하고, **재발송** 및 URL 복사로 복구 가능.
- 로컬·`AUTH_MODE=mock` 기본은 메일 미발송; 필요 시 env로 SMTP 테스트 가능.

---

## 2. 합의된 제품 결정

| 항목             | 결정                                                                  |
| ---------------- | --------------------------------------------------------------------- |
| 발송 수단        | **네이버 SMTP** (`smtp.naver.com`, 465 SSL 또는 587 STARTTLS)         |
| 발송 실패 시     | **D**: DB 초대 유지 + 관리자 안내 + 목록 **재발송** + URL 복사 유지   |
| mock / 로컬 기본 | **D**: `INVITE_MAIL_ENABLED=false` 기본, 켜면 동일 SMTP로 실발송 가능 |
| 재발송 시 토큰   | **변경 없음** (기존 링크 유효)                                        |

---

## 3. 아키텍처

### 모듈

| 파일                                              | 책임                                                                                      |
| ------------------------------------------------- | ----------------------------------------------------------------------------------------- |
| `src/lib/server/invite-mail.ts`                   | SMTP transport, `shouldSendInviteEmail()`, `sendAcademyInviteEmail()`, 수락 URL 빌드 헬퍼 |
| `src/lib/server/models/academy-invite.ts`         | `lastEmailSentAt`, `lastEmailError` 필드 추가                                             |
| `src/routes/platform/.../members/+page.server.ts` | `createInvite` 발송·메타 갱신; **`resendInvite`** 액션 신규                               |
| `src/routes/platform/.../members/+page.svelte`    | 메일 상태 열, 재발송 버튼, flash 메시지                                                   |

**비채택**: 발송 큐·워커(Bull 등) — 초대량·MVP 범위상 동기 발송.

### 발송 조건

```text
shouldSendInviteEmail() :=
  process.env.INVITE_MAIL_ENABLED === 'true'
  AND SMTP_USER, SMTP_PASS, INVITE_MAIL_FROM 가 비어 있지 않음
```

- `false` 또는 미설정: `sendAcademyInviteEmail` 호출 없음(또는 즉시 `skipped`). UI 「메일 미발송(설정)」.
- `true` + SMTP 설정: nodemailer로 네이버 발송.

### 수락 URL

```text
base = PUBLIC_APP_ORIGIN || BETTER_AUTH_URL || requestEvent.url.origin
acceptUrl = `${base}/invite/accept?token=${encodeURIComponent(token)}`
```

운영에서는 `PUBLIC_APP_ORIGIN` 또는 `BETTER_AUTH_URL`을 실제 공개 URL과 일치시킨다.

---

## 4. 환경 변수

`.env.example`에 추가:

```env
# 초대 메일 (네이버 SMTP). mock·로컬 기본은 미발송.
INVITE_MAIL_ENABLED=false
SMTP_HOST=smtp.naver.com
SMTP_PORT=465
SMTP_SECURE=true
SMTP_USER=
SMTP_PASS=
INVITE_MAIL_FROM=
INVITE_MAIL_FROM_NAME=학원 관리
# 수락 링크 베이스 (비우면 요청 origin 또는 BETTER_AUTH_URL)
PUBLIC_APP_ORIGIN=
```

- `SMTP_PASS`: 네이버 **앱 비밀번호**(2단계 인증 시).
- 비밀·토큰 전체는 서버 로그에 남기지 않는다.

---

## 5. 데이터 모델

`AcademyInvite` 스키마 추가:

| 필드              | 타입      | 설명                                    |
| ----------------- | --------- | --------------------------------------- |
| `lastEmailSentAt` | `Date?`   | 마지막 **성공** 발송 시각               |
| `lastEmailError`  | `string?` | 마지막 실패 메시지(max ~500자 truncate) |

**갱신 규칙**

- 발송 성공: `lastEmailSentAt = now`, `lastEmailError = undefined`
- 발송 실패: `lastEmailError = message`, `lastEmailSentAt` 유지
- skipped(미설정): 갱신 없음(또는 UI만 `INVITE_MAIL_ENABLED`로 표시)

---

## 6. 서버 플로우

### 6.1 `createInvite` (기존 + 메일)

1. 기존 검증·`AcademyInvite.create` (토큰·14일 만료·teacher `linkedTeacherId` 등 유지).
2. `shouldSendInviteEmail()`이 false → flash 「초대 생성 (메일 미발송 — 설정)」→ redirect.
3. true → `sendAcademyInviteEmail({ to: email, academyName, role, acceptUrl, expiresAt })`.
4. 결과로 `AcademyInvite.updateOne` (`lastEmail*`).
5. redirect + flash:
   - **성공**: 「초대를 생성했고 메일을 발송했습니다.」
   - **실패**: 「초대는 생성됐으나 메일 발송에 실패했습니다. 링크를 복사하거나 재발송하세요.」(+ 오류 요약)
   - **롤백 없음**.

### 6.2 `resendInvite` (신규)

- `POST ?/resendInvite`, body: `inviteId`
- `ensurePlatformSuperAdmin`, `academyId` 스코프 일치
- 만료·없음 → 404
- 동일 `sendAcademyInviteEmail`, 동일 토큰·URL
- `lastEmail*` 갱신, flash, redirect 목록

### 6.3 `sendAcademyInviteEmail`

- nodemailer transport (env 기반).
- `to`: 초대 `email`
- `from`: `"${INVITE_MAIL_FROM_NAME}" <${INVITE_MAIL_FROM}>`
- `subject`: `[${academyName}] 학원 멤버십 초대`
- `text` + 간단 `html` (한국어): 학원명, 역할, 수락 링크, 만료일(서울 표기 — `date-seoul` 재사용).
- 반환: `{ ok: true }` | `{ ok: false, error: string }` | `{ ok: true, skipped: true }`

---

## 7. UI

경로: `/platform/academies/[academyId]/members`

| 변경           | 내용                                                                           |
| -------------- | ------------------------------------------------------------------------------ |
| 테이블 열      | **메일 상태**: 발송됨(시각) / 실패(요약) / 미발송                              |
| 작업           | `철회` + **메일 재발송** (`resendInvite`)                                      |
| flash          | create·resend 결과 (성공·실패·미발송) — 기존 error 패턴 확장 또는 success 채널 |
| 수락 URL input | **유지** (수동 전달)                                                           |

---

## 8. 에러·보안

- SMTP 인증·연결·네이버 일일 한도: 사용자 메시지는 짧게, 상세는 서버 로그.
- `AUTH_MODE=mock`과 무관하게 발송 여부는 **`INVITE_MAIL_ENABLED`만** 본다(세션 mock ≠ 메일 mock).
- 메일 본문에 토큰 포함(수신자 이메일과 쌍). BCC 없음(MVP).

---

## 9. 테스트

| 대상                        | 내용                                                                |
| --------------------------- | ------------------------------------------------------------------- |
| `invite-mail`               | `shouldSendInviteEmail` 분기; stub transport로 수신자·제목·URL 포함 |
| `createInvite`              | 발송 실패 mock 시 invite row 존재 + `lastEmailError`                |
| `resendInvite`              | 성공 시 `lastEmailSentAt` 갱신                                      |
| `INVITE_MAIL_ENABLED=false` | transport 미호출                                                    |

검증 순서: `npm run check` → `npm test` → `npm run lint` → `npm run build`.

---

## 10. 범위 외 (후속)

- 비가입자 회원가입 후 `/invite/accept` 딥링크 복귀
- HTML 브랜딩 템플릿·영문
- 비동기 큐·자동 재시도 스케줄
- 학원별 발신 주소·다중 SMTP

---

## 11. 구현 순서 (writing-plans 입력용)

1. 스키마·env·`invite-mail.ts` + 단위 테스트
2. `createInvite` 연동 + `lastEmail*`
3. `resendInvite` 액션 + UI
4. `.env.example`·핸드오프 §0 한 줄·`inferred-decisions-log` 항목
5. 전체 검증
