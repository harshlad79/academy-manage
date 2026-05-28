# 학원 Lead·대기·공개 신청 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 학원별 공개 `/apply?a={academyId}`, 스태ff Lead 큐·전환, 첫 `Enrollment` 시 `Lead.enrolledAt`, 원장용 학원 멤버 초대 UI.

**Architecture:** `Lead` 모델 + `convertLead` 서비스; enrollment 생성 훅으로 `enrolledAt`; `/leads`는 `withAcademyScope` + elevated staff; `/settings/members`는 platform members 로직 공유.

**Tech Stack:** SvelteKit 5, Mongoose, Vitest.

**Spec:** [../specs/2026-05-28-platform-and-academy-leads-design.md](../specs/2026-05-28-platform-and-academy-leads-design.md)

**Depends on:** [2026-05-28-platform-academy-inquiry.md](./2026-05-28-platform-academy-inquiry.md) (Academy `trial|active` 존재)

---

## File map

| File | Action |
| ---- | ------ |
| `src/lib/server/models/lead.ts` | Create |
| `src/lib/server/models/lead.test.ts` | Create |
| `src/lib/server/lead-convert.ts` | Create |
| `src/lib/server/lead-convert.test.ts` | Create |
| `src/lib/server/lead-enrolled-at.ts` | Create — enrollment hook |
| `src/lib/server/lead-enrolled-at.test.ts` | Create |
| `src/routes/apply/+page.server.ts` | Create — public |
| `src/routes/apply/+page.svelte` | Create |
| `src/routes/apply/success/+page.svelte` | Create |
| `src/routes/leads/+page.server.ts` | Create |
| `src/routes/leads/+page.svelte` | Create |
| `src/routes/leads/[id]/+page.server.ts` | Create — optional detail |
| `src/routes/leads/[id]/+page.svelte` | Create |
| `src/routes/enrollments/+page.server.ts` | Modify — call `syncLeadEnrolledAt` |
| `src/lib/server/rbac.ts` | Modify — nav `/leads` |
| `src/routes/communications/+page.svelte` | Modify — leads 링크 |
| `src/lib/server/academy-members-invite.ts` | Create — extract from platform members |
| `src/routes/settings/members/+page.server.ts` | Create |
| `src/routes/settings/members/+page.svelte` | Create |
| `src/routes/+layout.svelte` | Modify — settings nav (academy_admin) |
| `docs/session-handoff-and-status.md` | Modify |

---

### Task 1: `Lead` model

**Files:**
- Create: `src/lib/server/models/lead.ts`
- Create: `src/lib/server/models/lead.test.ts`

- [ ] **Step 1:** 테스트 — status enum, source enum, phone normalize

```typescript
import { describe, expect, it } from 'vitest';
import { Lead, LEAD_STATUSES } from './lead';

describe('Lead', () => {
	it('exports expected statuses without enrolled', () => {
		expect(LEAD_STATUSES).toEqual([
			'new',
			'contacted',
			'waitlisted',
			'converted',
			'closed'
		]);
	});
});
```

- [ ] **Step 2:** 스키마

```typescript
export type LeadStatus = 'new' | 'contacted' | 'waitlisted' | 'converted' | 'closed';
export type LeadSource = 'web' | 'staff';

export type LeadDoc = {
	academyId: Types.ObjectId;
	studentName: string;
	guardianName: string;
	phone: string;
	memo?: string;
	source: LeadSource;
	status: LeadStatus;
	studentId?: Types.ObjectId;
	convertedAt?: Date;
	enrolledAt?: Date;
	assignedToUserId?: string;
	createdByUserId?: string;
	closeReason?: string;
};
```

- [ ] **Step 3:** 인덱스 `{ academyId: 1, status: 1, createdAt: -1 }`, `{ academyId: 1, phone: 1 }`
- [ ] **Step 4:** `npm test` → Commit `feat(leads): lead model`

---

### Task 2: `lead-convert.ts`

**Files:**
- Create: `src/lib/server/lead-convert.ts`
- Create: `src/lib/server/lead-convert.test.ts`

- [ ] **Step 1:** 테스트 — `convertLead(leadId, academyId)`:
  - `Student.create` with name, guardianName, guardianPhone from lead
  - lead `studentId`, `convertedAt`, `status='converted'`
  - idempotent guard if already converted
- [ ] **Step 2:** 구현 (`withAcademyScope` academyId 일치 검증)
- [ ] **Step 3:** `npm test` → Commit `feat(leads): convert lead to student`

---

### Task 3: `lead-enrolled-at.ts` + enrollment hook

**Files:**
- Create: `src/lib/server/lead-enrolled-at.ts`
- Create: `src/lib/server/lead-enrolled-at.test.ts`
- Modify: `src/routes/enrollments/+page.server.ts`

- [ ] **Step 1:** 테스트 — given `studentId`, first enrollment sets `Lead.enrolledAt` where `studentId` match and `enrolledAt` null

```typescript
export async function syncLeadEnrolledAt(options: {
	academyId: Types.ObjectId;
	studentId: Types.ObjectId;
	at?: Date;
}): Promise<void> {
	await Lead.updateOne(
		{
			academyId: options.academyId,
			studentId: options.studentId,
			enrolledAt: { $exists: false }
		},
		{ $set: { enrolledAt: options.at ?? new Date() } }
	);
}
```

- [ ] **Step 2:** enrollment create action 성공 직후 `await syncLeadEnrolledAt(...)`
- [ ] **Step 3:** `npm test` → Commit `feat(leads): set enrolledAt on first enrollment`

---

### Task 4: 공개 `/apply`

**Files:**
- Create: `src/routes/apply/+page.server.ts`
- Create: `src/routes/apply/+page.svelte`
- Create: `src/routes/apply/success/+page.svelte`

- [ ] **Step 1:** `load` — `url.searchParams.get('a')` → `isOidHex`, `Academy.findById`, 404 if missing; **허용 status:** `trial` | `active` only
- [ ] **Step 2:** `actions.default` — `Lead.create({ source:'web', status:'new', ... })`
- [ ] **Step 3:** 폼 UI + academy name 표시
- [ ] **Step 4:** Commit `feat(leads): public apply form per academy`

---

### Task 5: `/leads` 목록·필터

**Files:**
- Create: `src/routes/leads/+page.server.ts`
- Create: `src/routes/leads/+page.svelte`
- Modify: `src/lib/server/rbac.ts`

- [ ] **Step 1:** `NAV_LINKS_FULL`에 `{ href: '/leads', label: '상담·대기' }` — `communications` 앞 또는 대체 링크
- [ ] **Step 2:** `load` — `ensureStaffAcademyMember` + `isElevatedStaffRole` (teacher 403)
- [ ] **Step 3:** tabs/filter: `new`, `contacted`, `waitlisted`, `converted`, `closed`; converted 탭에 `enrolledAt` 유무 컬럼
- [ ] **Step 4:** Actions: `updateStatus`, `createStaffLead`, `convertLead` (gateDirectoryAction)
- [ ] **Step 5:** apply 링크 복사 UI: `${origin}/apply?a=${academyIdHex}`
- [ ] **Step 6:** Commit `feat(leads): staff lead queue UI`

---

### Task 6: Lead 상세(선택)·메모

**Files:**
- Create: `src/routes/leads/[id]/+page.server.ts`
- Create: `src/routes/leads/[id]/+page.svelte`

- [ ] **Step 1:** 단건 load + status actions + `convertLead` 버튼 → redirect student edit
- [ ] **Step 2:** converted + no `enrolledAt` → 「등록됨·수강 미배정」 배지
- [ ] **Step 3:** Commit `feat(leads): lead detail page`

---

### Task 7: `academy-members-invite.ts` extract

**Files:**
- Create: `src/lib/server/academy-members-invite.ts`
- Modify: `src/routes/platform/academies/[academyId]/members/+page.server.ts`

- [ ] **Step 1:** 공통 함수 추출: `loadMembersPageData(academyId)`, `createAcademyInvite(...)`, `resend...` (기존 동작 동일)
- [ ] **Step 2:** platform route가 extract 호출하도록 리팩터 (행동 변경 없음)
- [ ] **Step 3:** `npm test` → Commit `refactor(invite): shared academy members invite helpers`

---

### Task 8: `/settings/members` — academy_admin

**Files:**
- Create: `src/routes/settings/members/+page.server.ts`
- Create: `src/routes/settings/members/+page.svelte`
- Modify: `src/routes/+layout.svelte` (또는 공통 nav component)

- [ ] **Step 1:** `load` — `ensureStaffAcademyMember`; role `academy_admin` | `super_admin` only (office 403)
- [ ] **Step 2:** `withAcademyScope` academyId로 shared invite helpers; **platform URL 아님**
- [ ] **Step 3:** 초대 role: `office`, `teacher`, `parent` (not `academy_admin` self-invite loop guard)
- [ ] **Step 4:** Nav — academy_admin에게 「학원 설정」→ members 링크
- [ ] **Step 5:** Commit `feat(academy): academy_admin member invite settings`

---

### Task 9: Communications hub 링크

**Files:**
- Modify: `src/routes/communications/+page.server.ts`
- Modify: `src/routes/communications/+page.svelte`

- [ ] **Step 1:** load에 `leadCount` by status (optional aggregates)
- [ ] **Step 2:** 카드 → `/leads` 링크
- [ ] **Step 3:** Commit `feat(leads): communications hub links to leads`

---

### Task 10: Docs + verification

- [ ] **Step 1:** `docs/session-handoff-and-status.md` — `/apply`, `/leads`, `/settings/members`
- [ ] **Step 2:** `npm run check` → `npm test` → `npm run lint` → `npm run build`
- [ ] **Step 3:** Commit `docs: academy lead waitlist handoff`

---

## Spec self-review

| Spec § | Task |
| ------ | ---- |
| 3.1 `/apply` | 4 |
| 3.2 Lead model | 1 |
| 3.3 status B | 1 |
| 3.4 enrolledAt | 3 |
| 3.5 convert | 2, 5, 6 |
| 3.6 `/leads` UI | 5, 6, 9 |
| 3.7 academy members | 7, 8 |
