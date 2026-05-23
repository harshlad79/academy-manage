# 설계: 학부모 SMS 초대·보호자 연락처·알림 프로필

**날짜**: 2026-05-19  
**상태**: 승인됨 (brainstorming §1–§3)  
**범위**: `AcademyInvite` 전화 초대(학부모), `Student` 보호자 번호, SMS 발송 스텁, 학생·플랫폼 UI, 학부모 프로필 번호·동의(최소), 스태프 이메일 초대 유지.

**전제 문서**: [PRD.md](../../PRD.md) §5·§6, [session-handoff-and-status.md](../../session-handoff-and-status.md), [2026-05-19-live-oauth-design.md](./2026-05-19-live-oauth-design.md), [2026-05-15-invite-email-design.md](./2026-05-15-invite-email-design.md).

**후속 스펙(본 문서 범위 밖)**:

- **대기·리드·대시보드 큐** — Student 메모·`/communications`·수동 연락
- **실 SMS 업체 연동** — 본 스펙은 스텁·env; 운영 시 업체별 API 구현체 추가
- **성적·공지 대량 발송** — `/communications` 발송 엔진·템플릿

---

## 1. 배경·목표

### 현재

- 스태프: `AcademyInvite.email` + SMTP + `/invite/accept` + **이메일 엄격 일치**.
- 학부모: 자유 가입(소셜) + 스태프 `ParentStudentLink`; 플랫폼에서 `parent` **이메일 초대 가능**(비권장).
- `Student`에 연락처 필드 없음.
- SMS·알림 발송 코드 없음.

### 목표

- 상담·등록 시 **보호자 휴대번호** 저장(권장).
- 학부모 **SMS 초대 링크** → 로그인 → `parent` 멤버십(토큰만 검증, 1회·만료).
- 발송: **스텁 + env** (`INVITE_SMS_ENABLED`); 미설정 시 URL 복사.
- UI: **학생 편집** + **플랫폼 멤버**(C); 플랫폼 `parent` **이메일 초대 숨김**.
- 가입 후 **`/p/settings`** 에 연락 번호·SMS 수신 동의(알림용, 초대와 분리).

---

## 2. 합의된 제품 결정

| 항목                | 결정                                                  |
| ------------------- | ----------------------------------------------------- |
| 보호자 번호 수집    | **3**: CRM(`Student`) + 가입 후 프로필·동의           |
| 학부모 온보딩 기본  | **자유 가입**; SMS는 **보조**                         |
| 수락 검증           | **토큰만** (만료·1회 삭제); OAuth 전화 **비교 안 함** |
| 초대 식별           | 학부모 `phone`만; 스태프 `email`만 (**C**)            |
| 발송 UI             | 학생 편집 + 플랫폼 멤버 (**C**)                       |
| SMS MVP             | **스텁 + 문서에 업체 후보** (**C**)                   |
| 재발송              | 이메일과 동일 — **토큰 유지**, SMS/메일만 재시도      |
| 만료                | `defaultInviteExpiresAt()` (**14일**) 공통            |
| `ParentStudentLink` | 수락 후에도 **스태프가 연결** (자동 연결 안 함)       |

---

## 3. 역할별 초대·수락

```text
스태프 (teacher|office|academy_admin)
  email 필수 → SMTP → /invite/accept
  → 로그인 email === invite.email → 멤버십 → invite 삭제

학부모 (parent)
  phone 필수, email 없음 → SMS(또는 링크 복사) → /invite/accept
  → 로그인만 필요 (이메일 검사 없음) → parent 멤버십 → invite 삭제
  → 스태프가 ParentStudentLink 로 자녀 연결
```

---

## 4. 아키텍처

### 4.1 모듈

| 파일                                       | 책임                                                                        |
| ------------------------------------------ | --------------------------------------------------------------------------- |
| `src/lib/server/models/academy-invite.ts`  | `phone?`, `email?` role별 검증; `normalizeInvitePhone`; sparse unique index |
| `src/lib/server/models/student.ts`         | `guardianPhone?`, `guardianName?`                                           |
| `src/lib/server/invite-sms.ts`             | `shouldSendInviteSms`, `sendAcademyInviteSms` (스텁), URL 빌드 재사용       |
| `src/lib/server/invite-sms-meta.ts`        | `lastSmsSentAt`, `lastSmsError` 갱신 (email-meta 대칭)                      |
| `src/lib/server/invite-consume.ts`         | `parent` 분기: email 검사 생략                                              |
| `src/routes/invite/accept/+page.server.ts` | parent UI: `phone` 표시, `phone_mismatch` 없음                              |
| `src/routes/students/[id]/edit/*`          | 보호자 필드, `createParentSmsInvite`, `resendParentSmsInvite`               |
| `src/routes/platform/.../members/*`        | parent SMS 초대; parent 이메일 폼 숨김                                      |
| `src/routes/p/settings/*`                  | 학부모 `phone`, `smsMarketingConsent` 저장                                  |
| `src/lib/server/auth.ts`                   | `user.phone`, `user.smsMarketingConsentAt` (optional additionalFields)      |

### 4.2 비채택

- 별도 `ParentInvite` 컬렉션 — `AcademyInvite` 확장으로 충분.
- OAuth 전화번호 엄격 일치 (B) — 실무 리스크.
- 수락 시 SMS OTP (C) — 토큰-only로 단순화.

---

## 5. 데이터 모델

### 5.1 `Student`

| 필드            | 타입      | 설명                                          |
| --------------- | --------- | --------------------------------------------- |
| `guardianPhone` | `string?` | 보호자 휴대, `normalizeInvitePhone` 동일 규칙 |
| `guardianName`  | `string?` | 선택, max 80자                                |

- 학생 `update` 액션에서 함께 저장.
- SMS 초대 생성 시 기본값: `guardianPhone` (폼에서 override 가능).

### 5.2 `AcademyInvite`

| 필드            | 변경                           |
| --------------- | ------------------------------ |
| `email`         | **optional** (`parent`는 없음) |
| `phone`         | **optional** (`parent`는 필수) |
| `lastSmsSentAt` | `Date?`                        |
| `lastSmsError`  | `string?`                      |

**검증 (애플리케이션 레이어)**

- `role !== 'parent'`: `normalizeInviteEmail` 필수, `phone` 없음.
- `role === 'parent'`: `normalizeInvitePhone` 필수, `email` 없음.

**인덱스**

- `{ academyId: 1, email: 1 }` — `unique`, `partialFilterExpression: { email: { $type: 'string' } } }`
- `{ academyId: 1, phone: 1 }` — `unique`, `partialFilterExpression: { phone: { $type: 'string' } } }`

**전화 정규화 `normalizeInvitePhone`**

- 입력: 공백·하이픈 제거.
- 한국 휴대: `010` 시작 10~11자리 → 저장 `010XXXXXXXX` (11자리).
- 실패 시 `null` (400).

### 5.3 Better Auth `user` (live)

| additionalField         | 타입      | input                  |
| ----------------------- | --------- | ---------------------- |
| `phone`                 | `string?` | 프로필 폼에서만        |
| `smsMarketingConsentAt` | `date?`   | 동의 시각; 미동의 null |

- 초대 수락과 **무관**. 추후 `/communications` SMS 채널용.

---

## 6. SMS 발송 (스텁)

### 6.1 env (`.env.example`)

```env
# 초대 SMS. mock·로컬 기본은 미발송.
INVITE_SMS_ENABLED=false
# 업체별 (하나만 설정 — 구현체 추가 시)
INVITE_SMS_PROVIDER=stub
# INVITE_SMS_API_KEY=
# INVITE_SMS_SENDER=
```

### 6.2 `shouldSendInviteSms`

```text
INVITE_SMS_ENABLED === 'true'
AND (추후: provider별 필수 키 존재)
```

### 6.3 `sendAcademyInviteSms`

- 반환: `{ status: 'sent' }` | `{ status: 'failed', error }` | `{ status: 'skipped', reason }`
- **스텁**: `enabled`이면 `sent` 로그만; `disabled` → `skipped`.
- 메시지 본문(한국어): 학원명, 「학부모 포털 초대」, `acceptUrl`, 만료일(`formatSeoulDateString`).
- **실 연동**: `docs/개발자가-처리할-항목.md` §7 — 알리고·NHN Cloud·솔라피 등 후보.

### 6.4 수락 URL

이메일과 동일: `buildInviteAcceptUrl(origin, token)` → `/invite/accept?token=…`

---

## 7. 서버 플로우

### 7.1 `createParentSmsInvite` (학생 편집·플랫폼 공통 헬퍼)

1. `role = parent`, `phone` 정규화, `academyId` 스코프.
2. 동일 `(academyId, phone)` 미수락 초대 있으면 **409** 또는 기존 행 재사용 정책: **기존 미만료 초대가 있으면 재발송만 허용**(새 토큰 생성 안 함) — 구현 시 `findOne` 후 분기.
3. 없으면 `AcademyInvite.create` (token, expiresAt 14일).
4. `shouldSendInviteSms` → 발송 또는 skip; `lastSms*` 갱신.
5. flash + redirect.

### 7.2 `resendParentSmsInvite`

- `inviteId` 스코프 검증, 만료 시 400.
- **토큰 변경 없음** (이메일 재발송과 동일).

### 7.3 `consumeAcademyInviteForLoggedInUser`

```text
if inv.role === 'parent':
  session userId 필수; email 검사 생략
else:
  기존 email 엄격 일치
```

- 성공 시 `AcademyInvite.deleteOne` (기존).
- `dup_membership` 동일.

### 7.4 `/invite/accept` load UI

| `acceptUi`       | parent         | staff      |
| ---------------- | -------------- | ---------- |
| `need_login`     | ○              | ○          |
| `email_mismatch` | **사용 안 함** | ○          |
| `can_accept`     | 로그인됨       | email 일치 |

- parent: CTA 「카카오로 계속」등 (기존 OAuth 카피).

### 7.5 학부모 `/p/settings`

- `ensureParentPortal` (기존 `/p` 가드).
- `POST` 저장: `phone` 정규화, `smsMarketingConsent` 체크 시 `smsMarketingConsentAt = now`, 해제 시 null.
- **초대 SMS 번호와 불일치해도 허용** (알림용 별도).

---

## 8. UI

### 8.1 `/students/[id]/edit`

| 요소 | 내용                                                             |
| ---- | ---------------------------------------------------------------- |
| 폼   | `guardianName`, `guardianPhone` (학생 이름·학년과 함께 저장)     |
| 초대 | 「SMS 초대 보내기」— `guardianPhone` 없으면 disabled + 안내      |
| 상태 | 대기 중 parent 초대 1건 표시(전화·만료·SMS 상태·URL 복사·재발송) |

권한: `gateDirectoryAction` (기존 학생 편집과 동일).

### 8.2 `/platform/academies/[academyId]/members`

| 변경                 | 내용                                                                                                   |
| -------------------- | ------------------------------------------------------------------------------------------------------ |
| 초대 역할            | `parent` 선택 시 **전화 입력**; 이메일 필드 숨김                                                       |
| 스태프 역할          | 기존 **이메일** 초대만                                                                                 |
| 테이블               | parent 행: `phone`, SMS 상태; staff 행: `email`, 메일 상태                                             |
| `parent` 이메일 초대 | **제거**(신규 생성 불가; 기존 email-only parent 초대는 만료까지 유지 또는 마이그레이션 없이 읽기 전용) |

### 8.3 `/invite/accept`

- `role === 'parent'`: 안내 문구에 **초대된 번호 끝 4자리**만 표시(전체 번호 노출 최소화).
- 이메일 불일치 블록 미노출.

---

## 9. 에러·보안

| 상황              | 처리                                          |
| ----------------- | --------------------------------------------- |
| 만료 토큰         | `expired`                                     |
| 이미 수락(삭제됨) | `invalid`                                     |
| 링크 유출·선점    | 1회 삭제·만료로 피해 제한; 역할 `parent`만    |
| 토큰 브루트포스   | 기존과 동일(긴 random token); rate limit 후속 |
| SMS 미설정        | 초대 DB 유지 + URL 복사                       |
| mock              | SMS 비발송; 링크·수락 플로는 live와 동일      |

**공지·성적 발송(후속)**

- 발송 키: `Student.guardianPhone` 우선, 없으면 연결된 학부모 `user.phone` + `smsMarketingConsentAt`.
- **초대 `phone`과 발송 번호 동기화**는 운영 권장이지 수락 조건 아님.

---

## 10. 테스트·롤아웃

### 자동

- `normalizeInvitePhone` 단위 테스트
- `consumeAcademyInviteForLoggedInUser` — parent는 email 없이 수락, staff는 mismatch
- `shouldSendInviteSms` / stub `sendAcademyInviteSms`
- `npm run check` → `npm test` → `npm run lint` → `npm run build`

### 수동

| 시나리오                                     | 모드        |
| -------------------------------------------- | ----------- |
| 보호자 번호 저장 → SMS 초대 → 링크 복사 수락 | live/mock   |
| `INVITE_SMS_ENABLED=false` → skip 메시지     | local       |
| 플랫폼 parent SMS / 스태프 이메일 분리       | super_admin |
| 수락 후 `/p/settings` 번호·동의 저장         | parent 계정 |

### 문서·env

- `.env.example` — SMS 변수
- `docs/개발자가-처리할-항목.md` — **§7 초대 SMS**
- `docs/inferred-decisions-log.md` — 본 설계 요약 1건

---

## 11. 명시적 비범위

- 실제 알리고·솔라피 HTTP 연동(스텁만).
- 수락 시 `ParentStudentLink` 자동 생성.
- 대기·리드 대시보드.
- 학부모 이메일 초대 신규 생성.
