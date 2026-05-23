# 학부모 SMS 초대·보호자 연락처 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 학부모는 `phone` 기반 SMS 초대(토큰-only 수락), 스태프는 기존 이메일 초대 유지; 보호자 번호·학부모 알림 프로필 추가.

**Architecture:** `AcademyInvite`에 `phone`·SMS 메타 확장, `invite-sms.ts` 스텁, `invite-consume` parent 분기, 학생 편집·플랫폼 멤버·`/p/settings` UI.

**Tech Stack:** SvelteKit 5, Mongoose, Better Auth, Vitest.

**Spec:** [../specs/2026-05-19-invite-sms-phone-design.md](../specs/2026-05-19-invite-sms-phone-design.md)

---

## File map

| File                                              | Action                                     |
| ------------------------------------------------- | ------------------------------------------ |
| `src/lib/server/models/student.ts`                | Modify — guardian fields                   |
| `src/lib/server/models/academy-invite.ts`         | Modify — phone, optional email, indexes    |
| `src/lib/server/models/academy-invite.test.ts`    | Modify — phone normalize, role validation  |
| `src/lib/server/invite-sms.ts`                    | Create                                     |
| `src/lib/server/invite-sms.test.ts`               | Create                                     |
| `src/lib/server/invite-sms-meta.ts`               | Create                                     |
| `src/lib/server/invite-consume.ts`                | Modify — parent branch                     |
| `src/lib/server/invite-consume.test.ts`           | Modify                                     |
| `src/lib/server/auth.ts`                          | Modify — user.phone, smsMarketingConsentAt |
| `src/routes/invite/accept/+page.server.ts`        | Modify — parent acceptUi                   |
| `src/routes/invite/accept/+page.svelte`           | Modify — parent copy                       |
| `src/routes/students/[id]/edit/+page.server.ts`   | Modify — guardian, SMS actions             |
| `src/routes/students/[id]/edit/+page.svelte`      | Modify — UI                                |
| `src/routes/platform/.../members/+page.server.ts` | Modify — parent SMS, hide parent email     |
| `src/routes/platform/.../members/+page.svelte`    | Modify                                     |
| `src/routes/p/settings/+page.server.ts`           | Create                                     |
| `src/routes/p/settings/+page.svelte`              | Create                                     |
| `src/routes/p/+page.svelte`                       | Modify — settings 링크                     |
| `.env.example`                                    | Modify                                     |
| `docs/개발자가-처리할-항목.md`                    | Modify — §7                                |
| `docs/inferred-decisions-log.md`                  | Modify                                     |
| `docs/session-handoff-and-status.md`              | Modify §0                                  |

---

### Task 1: `normalizeInvitePhone` + Student guardian fields

**Files:**

- Modify: `src/lib/server/models/academy-invite.ts`
- Modify: `src/lib/server/models/academy-invite.test.ts`
- Modify: `src/lib/server/models/student.ts`

- [ ] **Step 1:** `normalizeInvitePhone` 테스트 (유효 010, 하이픈, 잘못된 번호)
- [ ] **Step 2:** 구현 + `Student.guardianPhone` / `guardianName`
- [ ] **Step 3:** `npm test` 해당 파일
- [ ] **Step 4:** Commit `feat(invite): phone normalize and student guardian fields`

---

### Task 2: `AcademyInvite` schema — optional email, phone, SMS meta, indexes

**Files:**

- Modify: `src/lib/server/models/academy-invite.ts`
- Modify: `src/lib/server/models/academy-invite.test.ts`

- [ ] **Step 1:** `validateInviteFields(role, email, phone)` 헬퍼 테스트
- [ ] **Step 2:** 스키마 `email` optional, `phone`, `lastSmsSentAt`, `lastSmsError`; partial unique indexes
- [ ] **Step 3:** `npm test`
- [ ] **Step 4:** Commit `feat(invite): academy invite phone channel schema`

---

### Task 3: `invite-sms.ts` + `invite-sms-meta.ts` (stub)

**Files:**

- Create: `src/lib/server/invite-sms.ts`
- Create: `src/lib/server/invite-sms.test.ts`
- Create: `src/lib/server/invite-sms-meta.ts`

- [ ] **Step 1:** `shouldSendInviteSms`, `sendAcademyInviteSms` skipped/sent 테스트
- [ ] **Step 2:** 스텁 구현 (`invite-mail.ts` 패턴)
- [ ] **Step 3:** `applyInviteSmsMeta` — `invite-email-meta` 대칭
- [ ] **Step 4:** Commit `feat(invite): invite SMS stub sender`

---

### Task 4: `invite-consume` parent branch

**Files:**

- Modify: `src/lib/server/invite-consume.ts`
- Modify: `src/lib/server/invite-consume.test.ts`
- Modify: `src/routes/invite/accept/+page.server.ts`

- [ ] **Step 1:** parent 수락 테스트 (email 없이 ok; staff mismatch 유지)
- [ ] **Step 2:** `resolveAcceptUi` — parent는 `can_accept` if session
- [ ] **Step 3:** `npm test`
- [ ] **Step 4:** Commit `feat(invite): parent token-only invite consume`

---

### Task 5: `/invite/accept` UI (parent)

**Files:**

- Modify: `src/routes/invite/accept/+page.svelte`

- [ ] **Step 1:** parent일 때 이메일 mismatch 블록 숨김, 전화 안내(끝 4자리)
- [ ] **Step 2:** `npm run lint`
- [ ] **Step 3:** Commit `feat(invite): parent accept page copy`

---

### Task 6: Student edit — guardian + SMS invite

**Files:**

- Modify: `src/routes/students/[id]/edit/+page.server.ts`
- Modify: `src/routes/students/[id]/edit/+page.svelte`

- [ ] **Step 1:** `update`에 guardian 필드; load에 pending parent invite
- [ ] **Step 2:** `createParentSmsInvite`, `resendParentSmsInvite` 액션 + SMS dispatch
- [ ] **Step 3:** UI — 보호자 입력, 초대·재발송·URL 복사
- [ ] **Step 4:** Commit `feat(invite): student edit parent SMS invite`

---

### Task 7: Platform members — parent SMS, hide parent email create

**Files:**

- Modify: `src/routes/platform/academies/[academyId]/members/+page.server.ts`
- Modify: `src/routes/platform/academies/[academyId]/members/+page.svelte`

- [ ] **Step 1:** `createInvite` — role parent → phone + SMS; else email + mail
- [ ] **Step 2:** `resendParentSmsInvite` / 테이블 SMS 열
- [ ] **Step 3:** parent 역할 이메일 입력 숨김
- [ ] **Step 4:** Commit `feat(invite): platform parent SMS invite`

---

### Task 8: Better Auth profile + `/p/settings`

**Files:**

- Modify: `src/lib/server/auth.ts`
- Create: `src/routes/p/settings/+page.server.ts`
- Create: `src/routes/p/settings/+page.svelte`
- Modify: `src/routes/p/+page.svelte`

- [ ] **Step 1:** `user.phone`, `user.smsMarketingConsentAt` additionalFields
- [ ] **Step 2:** settings load/action — parent only, phone normalize, consent timestamp
- [ ] **Step 3:** `/p`에서 설정 링크
- [ ] **Step 4:** Commit `feat(parent): profile phone and SMS consent settings`

---

### Task 9: env + docs

**Files:**

- Modify: `.env.example`
- Modify: `docs/개발자가-처리할-항목.md`
- Modify: `docs/inferred-decisions-log.md`
- Modify: `docs/session-handoff-and-status.md`

- [ ] **Step 1:** env 주석·§7 SMS 업체 체크리스트(알리고·NHN·솔라피 후보)
- [ ] **Step 2:** handoff §0 한 줄 갱신
- [ ] **Step 3:** Commit `docs: invite SMS env and developer checklist`

---

### Task 10: Full verification

- [ ] `npm run check`
- [ ] `npm test`
- [ ] `npm run lint`
- [ ] `npm run build`
- [ ] Commit only if hook reformats — `chore: verify invite sms phone slice`

---

## Out of scope (this plan)

- Real Aligo/Solapi HTTP client
- Auto `ParentStudentLink` on accept
- Bulk communications send engine
