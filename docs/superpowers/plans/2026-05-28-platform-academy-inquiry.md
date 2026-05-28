# 플랫폼 학원 등록 문의·Trial Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 공개 학원 등록 문의 폼, super_admin 문의 큐, trial 승인 시 `Academy(trial)` + 원장 `academy_admin` 이메일 초대, trial 만료·외부 연동 차단.

**Architecture:** `AcademyInquiry` 모델 + `/platform/inquiries` 액션으로 Academy·Invite 생성; `Academy.status`에 `trial`·`trialEndsAt` 추가; `active-academy`·루트 레이아웃·invite 발송 경로에 trial 게이트.

**Tech Stack:** SvelteKit 5, Mongoose, Better Auth, Vitest.

**Spec:** [../specs/2026-05-28-platform-and-academy-leads-design.md](../specs/2026-05-28-platform-and-academy-leads-design.md)

**Depends on:** `main` (AcademyInvite, invite-mail/SMS stub)

**Blocks:** [2026-05-28-academy-lead-waitlist.md](./2026-05-28-academy-lead-waitlist.md) — `/apply`는 trial/active 학원만 허용

---

## File map

| File                                              | Action                                                                           |
| ------------------------------------------------- | -------------------------------------------------------------------------------- |
| `src/lib/server/models/academy-inquiry.ts`        | Create                                                                           |
| `src/lib/server/models/academy-inquiry.test.ts`   | Create                                                                           |
| `src/lib/server/models/academy.ts`                | Modify — `trial`, `trialEndsAt`                                                  |
| `src/lib/server/models/academy.test.ts`           | Create or modify                                                                 |
| `src/lib/server/academy-trial.ts`                 | Create — `isTrialExpired`, `academyBlocksExternalComms`, `academyBlocksStaffApp` |
| `src/lib/server/academy-trial.test.ts`            | Create                                                                           |
| `src/lib/server/active-academy.ts`                | Modify — status map `trial`, operational status                                  |
| `src/lib/server/active-academy.test.ts`           | Modify                                                                           |
| `src/lib/server/platform-inquiry-approve.ts`      | Create — trial 승인 트랜잭션                                                     |
| `src/lib/server/platform-inquiry-approve.test.ts` | Create                                                                           |
| `src/lib/server/invite-mail.ts`                   | Modify — trial 외부 차단 훅(옵션 인자 또는 academy lookup)                       |
| `src/lib/server/invite-sms.ts`                    | Modify — 동일                                                                    |
| `src/routes/academy-inquiry/+page.server.ts`      | Create — 공개 POST                                                               |
| `src/routes/academy-inquiry/+page.svelte`         | Create                                                                           |
| `src/routes/academy-inquiry/success/+page.svelte` | Create                                                                           |
| `src/routes/platform/inquiries/+page.server.ts`   | Create                                                                           |
| `src/routes/platform/inquiries/+page.svelte`      | Create                                                                           |
| `src/routes/platform/+page.svelte`                | Modify — 문의 큐 링크                                                            |
| `src/routes/platform/academies/+page.svelte`      | Modify — status `trial` 배지                                                     |
| `src/routes/+layout.server.ts`                    | Modify — trial 만료 staff 차단                                                   |
| `src/routes/trial-expired/+page.svelte`           | Create — 안내 전용(선택 redirect target)                                         |
| `src/app.d.ts`                                    | Modify — `academyOperationalStatus` union                                        |
| `docs/session-handoff-and-status.md`              | Modify §0                                                                        |
| `docs/inferred-decisions-log.md`                  | Modify                                                                           |

---

### Task 1: `Academy` — `trial` status + `trialEndsAt`

**Files:**

- Modify: `src/lib/server/models/academy.ts`
- Create: `src/lib/server/models/academy.test.ts` (없으면)

- [ ] **Step 1:** 테스트 — enum에 `trial` 허용, `trialEndsAt` optional Date

```typescript
import { describe, expect, it } from 'vitest';
import { Academy } from './academy';

describe('Academy schema', () => {
	it('accepts trial status with trialEndsAt', () => {
		const doc = new Academy({
			name: 'Test',
			status: 'trial',
			trialEndsAt: new Date('2026-06-01')
		});
		const err = doc.validateSync();
		expect(err).toBeUndefined();
		expect(doc.status).toBe('trial');
	});
});
```

- [ ] **Step 2:** 구현

```typescript
export type AcademyStatus = 'trial' | 'active' | 'inactive';

export type AcademyDoc = {
	name: string;
	status: AcademyStatus;
	trialEndsAt?: Date;
	createdAt: Date;
	updatedAt: Date;
};
// schema: status enum ['trial','active','inactive'], trialEndsAt: Date
```

- [ ] **Step 3:** `npm test src/lib/server/models/academy.test.ts`
- [ ] **Step 4:** Commit `feat(platform): academy trial status and trialEndsAt`

---

### Task 2: `academy-trial.ts` helpers

**Files:**

- Create: `src/lib/server/academy-trial.ts`
- Create: `src/lib/server/academy-trial.test.ts`

- [ ] **Step 1:** 테스트

```typescript
import { describe, expect, it } from 'vitest';
import { academyBlocksExternalComms, academyBlocksStaffApp, isTrialExpired } from './academy-trial';

describe('academy-trial', () => {
	const ends = new Date('2026-01-10T00:00:00Z');
	const before = new Date('2026-01-09T12:00:00Z');
	const after = new Date('2026-01-11T00:00:00Z');

	it('isTrialExpired when trial past ends', () => {
		expect(isTrialExpired('trial', ends, after)).toBe(true);
		expect(isTrialExpired('trial', ends, before)).toBe(false);
		expect(isTrialExpired('active', ends, after)).toBe(false);
	});

	it('blocks staff app only when trial expired', () => {
		expect(academyBlocksStaffApp('trial', ends, after)).toBe(true);
		expect(academyBlocksStaffApp('trial', ends, before)).toBe(false);
	});

	it('blocks external comms for trial (even not expired)', () => {
		expect(academyBlocksExternalComms('trial', ends, before)).toBe(true);
		expect(academyBlocksExternalComms('active', ends, before)).toBe(false);
	});
});
```

- [ ] **Step 2:** 구현 (순수 함수, `now` injectable for tests)
- [ ] **Step 3:** `npm test src/lib/server/academy-trial.test.ts`
- [ ] **Step 4:** Commit `feat(platform): academy trial gate helpers`

---

### Task 3: `active-academy` — resolve `trial` context

**Files:**

- Modify: `src/lib/server/active-academy.ts`
- Modify: `src/lib/server/active-academy.test.ts` (있으면)
- Modify: `src/app.d.ts`

- [ ] **Step 1:** `loadAcademyStatusMap` → `'trial' | 'active' | 'inactive'`
- [ ] **Step 2:** `academyAllowsResolvedContext` / `academyAllowsStaffContext`:
  - `trial` + not expired → staff 허용 (super_admin 포함)
  - `trial` + expired → `super_admin`만 staff context (inactive와 동일 패턴)
  - `parent` on trial academy: active와 동일 허용(스펙: 데이터 열람 유지)
- [ ] **Step 3:** `ResolvedAcademyContext.academyOperationalStatus` → `'active' | 'inactive' | 'trial_locked'`
  - `trial` 미만료 → `'active'` (UI 배너만 trial 표시용 별도 `academyBillingStatus` 추가 가능)
  - `trial` 만료 → `'trial_locked'`
- [ ] **Step 4:** 테스트 업데이트 + `npm test`
- [ ] **Step 5:** Commit `feat(platform): resolve trial academy in active context`

---

### Task 4: Staff layout — trial 만료 차단

**Files:**

- Modify: `src/routes/+layout.server.ts`
- Create: `src/routes/trial-expired/+page.svelte`

- [ ] **Step 1:** `locals.academyOperationalStatus === 'trial_locked'` && role not `super_admin` → `redirect(303, '/trial-expired')` (platform 경로 제외)
- [ ] **Step 2:** `/trial-expired` 정적 안내 페이지 (플랫폼 연락 CTA placeholder)
- [ ] **Step 3:** `npm run check`
- [ ] **Step 4:** Commit `feat(platform): redirect staff when trial expired`

---

### Task 5: `AcademyInquiry` model

**Files:**

- Create: `src/lib/server/models/academy-inquiry.ts`
- Create: `src/lib/server/models/academy-inquiry.test.ts`

- [ ] **Step 1:** 상태 enum·필드 검증 테스트 (`normalizeInvitePhone`, `normalizeInviteEmail` 재사용)
- [ ] **Step 2:** 스키마 + 인덱스 `status`, `createdAt`, `email`
- [ ] **Step 3:** `npm test`
- [ ] **Step 4:** Commit `feat(platform): academy inquiry model`

---

### Task 6: `platform-inquiry-approve.ts`

**Files:**

- Create: `src/lib/server/platform-inquiry-approve.ts`
- Create: `src/lib/server/platform-inquiry-approve.test.ts`

- [ ] **Step 1:** 테스트 (in-memory mongo or mocked):
  - 입력: inquiry doc, `trialDays` (default 7), `processedByUserId`
  - 출력: `Academy` status `trial`, `trialEndsAt`, inquiry `status=trial`, `academyId` set
  - `AcademyInvite` created: `role=academy_admin`, email from inquiry
- [ ] **Step 2:** 구현 — `mongoose.startSession` transaction
- [ ] **Step 3:** `approveInquiryToActive(academyId)` — `Academy.status=active`, clear `trialEndsAt`, inquiry `approved`
- [ ] **Step 4:** `npm test`
- [ ] **Step 5:** Commit `feat(platform): inquiry trial approve service`

---

### Task 7: Invite dispatch — trial 외부 차단

**Files:**

- Modify: `src/lib/server/invite-mail.ts`
- Modify: `src/lib/server/invite-sms.ts`
- Modify: `src/routes/platform/academies/[academyId]/members/+page.server.ts`

- [ ] **Step 1:** `sendAcademyInviteEmail` / `dispatchInviteSms` 시작 시 `Academy.findById` → `academyBlocksExternalComms` 이면 skipped 결과 반환 (메타에 `trial_blocked` reason)
- [ ] **Step 2:** platform members UI notice에 trial 차단 메시지
- [ ] **Step 3:** `npm test` invite 관련
- [ ] **Step 4:** Commit `feat(platform): block invite mail/sms during trial`

---

### Task 8: 공개 `/academy-inquiry`

**Files:**

- Create: `src/routes/academy-inquiry/+page.server.ts`
- Create: `src/routes/academy-inquiry/+page.svelte`
- Create: `src/routes/academy-inquiry/success/+page.svelte`

- [ ] **Step 1:** `load` — 로그인 불필요; `actions.default` — 필드 검증 후 `AcademyInquiry.create({ status:'new' })`
- [ ] **Step 2:** 폼 UI (학원명, 담당자, phone, email, region, memo)
- [ ] **Step 3:** success 페이지
- [ ] **Step 4:** 랜딩/푸터에 링크(선택) — `src/routes/+page.svelte` 또는 auth layout
- [ ] **Step 5:** Commit `feat(platform): public academy inquiry form`

---

### Task 9: `/platform/inquiries` 큐 UI

**Files:**

- Create: `src/routes/platform/inquiries/+page.server.ts`
- Create: `src/routes/platform/inquiries/+page.svelte`
- Modify: `src/routes/platform/+page.svelte`

- [ ] **Step 1:** `load` — `ensurePlatformSuperAdmin`, status 필터, rows
- [ ] **Step 2:** Actions: `markContacted`, `approveTrial` (form: `inquiryId`, `trialDays` default 7), `approveActive`, `reject`
- [ ] **Step 3:** `approveTrial` → `platformInquiryApprove` + `dispatchInviteEmail` (trial 차단되므로 **스텁 URL만 UI 표시** 또는 mock에서만 발송 — 문서화: trial 중 메일 실발송 X, 초대 URL은 화면 복사)
  - **MVP:** trial 승인 시 invite row 생성 + accept URL을 super_admin 화면에 표시(메일 스텁과 동일 패턴)
- [ ] **Step 4:** 상세 패널: inquiry 필드, 연결 academy 링크
- [ ] **Step 5:** Commit `feat(platform): super admin inquiry queue`

---

### Task 10: Platform academies — trial 표시

**Files:**

- Modify: `src/routes/platform/academies/+page.server.ts` (reactivate 시 trial→active 옵션)
- Modify: `src/routes/platform/academies/+page.svelte`

- [ ] **Step 1:** 목록에 `trial` 배지, `trialEndsAt` 표시
- [ ] **Step 2:** `reactivateAcademy`는 `inactive`만; trial→active는 inquiries `approveActive` 우선
- [ ] **Step 3:** Commit `feat(platform): show trial academies in platform list`

---

### Task 11: Docs + verification

**Files:**

- Modify: `docs/session-handoff-and-status.md`
- Modify: `docs/inferred-decisions-log.md`

- [ ] **Step 1:** handoff §0에 inquiry·trial 경로 기록
- [ ] **Step 2:** `npm run check` → `npm test` → `npm run lint` → `npm run build`
- [ ] **Step 3:** Commit `docs: platform academy inquiry handoff`

---

## Spec self-review

| Spec §                  | Task       |
| ----------------------- | ---------- |
| 2.1 공개 폼             | 8          |
| 2.2 AcademyInquiry      | 5          |
| 2.3 상태                | 5, 9       |
| 2.4 Academy trial       | 1          |
| 2.5 trial 정책          | 2, 3, 4, 7 |
| 2.6 platform/inquiries  | 6, 9       |
| 2.7 기존 academies 유지 | 10         |
