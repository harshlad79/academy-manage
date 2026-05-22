# Live OAuth (카카오·네이버·구글) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** `AUTH_MODE=live`에서 Better Auth 소셜 3종·모바일 `/auth/sign-in`·약관 1회·스태프 이메일 초대 수락 플로를 완성한다.

**Architecture:** `auth.ts`에 `socialProviders`와 `user.additionalFields.termsAcceptedAt` 추가. `/auth/sign-in`은 mock이면 기존 안내만, live면 소셜 풀폭 버튼 + `inviteEmail` 있을 때만 이메일·비밀번호. OAuth 신규 사용자는 `hooks.server.ts`가 약관 미동의 시 `/auth/accept-terms`로 보낸다. 초대·수락은 기존 `invite-return`·`consume` 유지.

**Tech Stack:** SvelteKit 5, Better Auth, MongoDB adapter, Vitest, Tailwind 4.

**Spec:** [docs/superpowers/specs/2026-05-19-live-oauth-design.md](../specs/2026-05-19-live-oauth-design.md)

---

## File map

| File | Action |
|------|--------|
| `src/lib/server/auth.ts` | Modify — social providers, `termsAcceptedAt`, helpers |
| `src/lib/server/auth-social.ts` | Create — env·provider 빌드 (auth.ts 비대화 방지) |
| `src/lib/server/auth-social.test.ts` | Create — provider/env 단위 테스트 |
| `src/lib/server/terms-gate.ts` | Create — 약관 필요 여부·경로 예외 |
| `src/lib/server/terms-gate.test.ts` | Create |
| `src/hooks.server.ts` | Modify — 약관 게이트 리다이렉트 |
| `src/routes/auth/sign-in/+page.server.ts` | Modify — `liveSocial`, enabled providers |
| `src/routes/auth/sign-in/+page.svelte` | Modify — 소셜 UI·조건부 이메일 폼 |
| `src/routes/auth/accept-terms/+page.server.ts` | Create |
| `src/routes/auth/accept-terms/+page.svelte` | Create |
| `src/routes/invite/accept/+page.svelte` | Modify — 카카오 CTA 문구 |
| `.env.example` | Modify — KAKAO/NAVER/GOOGLE |
| `docs/개발자가-처리할-항목.md` | Modify — Redirect URI 예시 |
| `docs/session-handoff-and-status.md` | Modify — §0 한 줄 |

**Out of scope:** SMS 초대, `parent` 초대 UI 제거, 대기 큐.

---

### Task 1: 소셜 env 헬퍼 + 단위 테스트

**Files:**
- Create: `src/lib/server/auth-social.ts`
- Create: `src/lib/server/auth-social.test.ts`

- [ ] **Step 1: Write the failing test**

```typescript
import { describe, expect, it } from 'vitest';
import { buildSocialProviders, type SocialProviderId } from './auth-social';

describe('buildSocialProviders', () => {
	it('키가 있는 제공자만 포함', () => {
		const env = {
			KAKAO_CLIENT_ID: 'k-id',
			KAKAO_CLIENT_SECRET: 'k-secret',
			NAVER_CLIENT_ID: '',
			NAVER_CLIENT_SECRET: '',
			GOOGLE_CLIENT_ID: 'g-id',
			GOOGLE_CLIENT_SECRET: 'g-secret'
		};
		const p = buildSocialProviders(env);
		expect(Object.keys(p).sort()).toEqual(['google', 'kakao']);
	});
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- src/lib/server/auth-social.test.ts`  
Expected: FAIL — module not found

- [ ] **Step 3: Implement `auth-social.ts`**

```typescript
import type { BetterAuthOptions } from 'better-auth';

export type SocialProviderId = 'kakao' | 'naver' | 'google';

export type SocialEnv = {
	KAKAO_CLIENT_ID?: string;
	KAKAO_CLIENT_SECRET?: string;
	NAVER_CLIENT_ID?: string;
	NAVER_CLIENT_SECRET?: string;
	GOOGLE_CLIENT_ID?: string;
	GOOGLE_CLIENT_SECRET?: string;
};

function pair(id?: string, secret?: string): { clientId: string; clientSecret: string } | null {
	const a = id?.trim();
	const b = secret?.trim();
	if (!a || !b) return null;
	return { clientId: a, clientSecret: b };
}

export function buildSocialProviders(
	env: SocialEnv
): NonNullable<BetterAuthOptions['socialProviders']> {
	const out: NonNullable<BetterAuthOptions['socialProviders']> = {};
	const kakao = pair(env.KAKAO_CLIENT_ID, env.KAKAO_CLIENT_SECRET);
	const naver = pair(env.NAVER_CLIENT_ID, env.NAVER_CLIENT_SECRET);
	const google = pair(env.GOOGLE_CLIENT_ID, env.GOOGLE_CLIENT_SECRET);
	if (kakao) out.kakao = kakao;
	if (naver) out.naver = naver;
	if (google) out.google = google;
	return out;
}

export function listEnabledSocialProviders(env: SocialEnv): SocialProviderId[] {
	return (Object.keys(buildSocialProviders(env)) as SocialProviderId[]).sort();
}

export function isAnySocialProviderConfigured(env: SocialEnv): boolean {
	return listEnabledSocialProviders(env).length > 0;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test -- src/lib/server/auth-social.test.ts`  
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/lib/server/auth-social.ts src/lib/server/auth-social.test.ts
git commit -m "feat(auth): add social provider env builder"
```

---

### Task 2: `auth.ts` — socialProviders + termsAcceptedAt

**Files:**
- Modify: `src/lib/server/auth.ts`
- Modify: `src/lib/server/auth-social.test.ts` (export re-export test optional)

- [ ] **Step 1: Wire social providers in `getLiveAuth`**

`getLiveAuth` 내부 `betterAuth({...})`에 추가:

```typescript
import { buildSocialProviders } from '$lib/server/auth-social';

// inside betterAuth({
user: {
	additionalFields: {
		termsAcceptedAt: {
			type: 'date',
			required: false,
			input: false
		}
	}
},
socialProviders: buildSocialProviders({
	KAKAO_CLIENT_ID: env.KAKAO_CLIENT_ID,
	KAKAO_CLIENT_SECRET: env.KAKAO_CLIENT_SECRET,
	NAVER_CLIENT_ID: env.NAVER_CLIENT_ID,
	NAVER_CLIENT_SECRET: env.NAVER_CLIENT_SECRET,
	GOOGLE_CLIENT_ID: env.GOOGLE_CLIENT_ID,
	GOOGLE_CLIENT_SECRET: env.GOOGLE_CLIENT_SECRET
}),
emailAndPassword: { enabled: true }
```

`getLiveAuth` export 옆에 re-export:

```typescript
export { isAnySocialProviderConfigured, listEnabledSocialProviders } from '$lib/server/auth-social';
```

- [ ] **Step 2: Run check**

Run: `npm run check`  
Expected: PASS (또는 env 타입 경고 없음)

- [ ] **Step 3: Commit**

```bash
git add src/lib/server/auth.ts
git commit -m "feat(auth): wire kakao naver google and termsAcceptedAt"
```

---

### Task 3: 약관 게이트 (`terms-gate` + hooks)

**Files:**
- Create: `src/lib/server/terms-gate.ts`
- Create: `src/lib/server/terms-gate.test.ts`
- Modify: `src/hooks.server.ts`

- [ ] **Step 1: Write failing tests**

```typescript
import { describe, expect, it } from 'vitest';
import { needsTermsAcceptance, shouldSkipTermsGate } from './terms-gate';

describe('shouldSkipTermsGate', () => {
	it('auth 경로는 스킵', () => {
		expect(shouldSkipTermsGate('/auth/sign-in')).toBe(true);
		expect(shouldSkipTermsGate('/api/auth/callback/kakao')).toBe(true);
	});
	it('invite accept 공개 경로 스킵', () => {
		expect(shouldSkipTermsGate('/invite/accept')).toBe(true);
	});
});

describe('needsTermsAcceptance', () => {
	it('termsAcceptedAt 없으면 true', () => {
		expect(needsTermsAcceptance({ termsAcceptedAt: null })).toBe(true);
	});
	it('있으면 false', () => {
		expect(needsTermsAcceptance({ termsAcceptedAt: new Date() })).toBe(false);
	});
});
```

- [ ] **Step 2: Run test — expect FAIL**

Run: `npm test -- src/lib/server/terms-gate.test.ts`

- [ ] **Step 3: Implement `terms-gate.ts`**

```typescript
type TermsUser = { termsAcceptedAt?: Date | string | null };

export function needsTermsAcceptance(user: TermsUser | null | undefined): boolean {
	if (!user) return false;
	const v = user.termsAcceptedAt;
	return v == null || v === '';
}

export function shouldSkipTermsGate(pathname: string): boolean {
	if (pathname.startsWith('/auth/')) return true;
	if (pathname.startsWith('/api/auth')) return true;
	if (pathname === '/invite/accept') return true;
	return false;
}
```

- [ ] **Step 4: Patch `hooks.server.ts`** (live 분기, `getSession` 직후)

```typescript
import { isMockAuthMode } from '$lib/server/auth';
import { needsTermsAcceptance, shouldSkipTermsGate } from '$lib/server/terms-gate';
import { redirect } from '@sveltejs/kit';

// after bundle assigned to locals.user in live branch:
if (!isMockAuthMode() && event.locals.user && needsTermsAcceptance(event.locals.user as { termsAcceptedAt?: Date | null })) {
	const path = event.url.pathname;
	if (!shouldSkipTermsGate(path)) {
		const next = `${path}${event.url.search}`;
		redirect(303, `/auth/accept-terms?next=${encodeURIComponent(next)}`);
	}
}
```

주의: `redirect`는 throw — `attachAcademyMembership` 전에 두거나, accept-terms에서는 membership 불필요.

- [ ] **Step 5: Run tests + check**

Run: `npm test -- src/lib/server/terms-gate.test.ts && npm run check`

- [ ] **Step 6: Commit**

```bash
git add src/lib/server/terms-gate.ts src/lib/server/terms-gate.test.ts src/hooks.server.ts
git commit -m "feat(auth): redirect to accept-terms when not accepted"
```

---

### Task 4: `/auth/accept-terms` 페이지

**Files:**
- Create: `src/routes/auth/accept-terms/+page.server.ts`
- Create: `src/routes/auth/accept-terms/+page.svelte`

- [ ] **Step 1: `+page.server.ts`**

```typescript
import { fail, redirect } from '@sveltejs/kit';
import { isMockAuthMode, getAuth } from '$lib/server/auth';
import { needsTermsAcceptance } from '$lib/server/terms-gate';
import type { Actions, PageServerLoad } from './$types';

function safeNext(raw: string | null): string {
	const n = raw?.trim() || '/';
	if (!n.startsWith('/') || n.startsWith('//')) return '/';
	return n;
}

export const load: PageServerLoad = async ({ locals, url }) => {
	if (isMockAuthMode()) redirect(303, '/');
	if (!locals.user) redirect(303, `/auth/sign-in?callbackURL=${encodeURIComponent(safeNext(url.searchParams.get('next')))}`);
	if (!needsTermsAcceptance(locals.user as { termsAcceptedAt?: Date | null })) {
		redirect(303, safeNext(url.searchParams.get('next')));
	}
	return { next: safeNext(url.searchParams.get('next')) };
};

export const actions: Actions = {
	accept: async ({ locals, url }) => {
		const uid = locals.user?.id;
		if (!uid) return fail(401, { error: '로그인이 필요합니다.' });
		const auth = getAuth();
		// Better Auth internal adapter or api.updateUser — 구현 시 auth.api.updateUser 사용
		await auth.api.updateUser({
			body: { termsAcceptedAt: new Date() },
			headers: new Headers() // 세션 쿠키는 request에서 전달 — SvelteKit action에서 request headers 전달 필요
		});
		redirect(303, safeNext(url.searchParams.get('next')));
	}
};
```

**구현 노트:** `updateUser`는 `event.request.headers`를 `hooks`와 동일하게 넘긴다. API가 없으면 Mongo `user` 컬렉션에 `termsAcceptedAt` 직접 갱신(live only) — plan 실행 시 Better Auth 문서로 `api.updateUser` 시그니처 확인.

- [ ] **Step 2: `+page.svelte`** — 체크박스 + submit + 서비스·개인정보 링크 placeholder

```svelte
<form method="POST" action="?/accept">
  <label><input type="checkbox" name="agree" required /> 이용약관 및 개인정보 처리에 동의합니다.</label>
  <button type="submit">동의하고 계속</button>
</form>
```

- [ ] **Step 3: Manual smoke** — mock에서는 redirect `/` 확인

- [ ] **Step 4: Commit**

```bash
git add src/routes/auth/accept-terms/
git commit -m "feat(auth): accept-terms page for first-time users"
```

---

### Task 5: `/auth/sign-in` — 소셜 UI + 조건부 이메일 폼

**Files:**
- Modify: `src/routes/auth/sign-in/+page.server.ts`
- Modify: `src/routes/auth/sign-in/+page.svelte`

- [ ] **Step 1: Extend load**

```typescript
import { isMockAuthMode, listEnabledSocialProviders } from '$lib/server/auth';
import { env } from '$env/dynamic/private';

// return 추가:
liveSocial: !isMock && listEnabledSocialProviders({
	KAKAO_CLIENT_ID: env.KAKAO_CLIENT_ID,
	// ...
}),
```

- [ ] **Step 2: Add social handlers in `+page.svelte`**

```typescript
async function signInWith(provider: 'kakao' | 'naver' | 'google') {
	clientError = null;
	busy = true;
	try {
		await authClient.signIn.social({
			provider,
			callbackURL: data.inviteEmail ? inviteReturnPath : '/'
		});
	} catch {
		clientError = '소셜 로그인을 시작하지 못했습니다.';
	} finally {
		busy = false;
	}
}
```

- [ ] **Step 3: Layout (live, non-mock)**

순서: 초대 이메일 안내 → `{#each data.liveSocial as provider}` 풀폭 버튼 (카카오 `#FEE500` 스타일 optional) → `{#if data.inviteEmail}` 기존 탭·이메일 폼 → `{:else}` 학부모 안내 문구만.

`data.liveSocial.length === 0` 이면 amber 박스: “OAuth 키 미설정 — mock 또는 .env 참고”.

- [ ] **Step 4: signUp — terms checkbox**

가입 탭에 `termsAgreed` state + checkbox required. `signUp.email` body에 `termsAcceptedAt: new Date()` if BA client accepts additional fields on signUp — else 가입 후 `accept-terms`로 hooks가 보냄.

- [ ] **Step 5: Run lint + check**

Run: `npm run lint && npm run check`

- [ ] **Step 6: Commit**

```bash
git add src/routes/auth/sign-in/
git commit -m "feat(auth): mobile-first social sign-in UI"
```

---

### Task 6: `/invite/accept` 모바일 CTA 문구

**Files:**
- Modify: `src/routes/invite/accept/+page.svelte`

- [ ] **Step 1: Update copy**

`need_login` / `email_mismatch` 버튼·문구:

- 버튼 라벨: **「카카오로 계속」** (mock이면 기존)
- 보조 문구: “네이버·구글도 가능. 초대 이메일과 **같은 소셜 계정**으로 로그인하세요.”

- [ ] **Step 2: Commit**

```bash
git add src/routes/invite/accept/+page.svelte
git commit -m "docs(ui): invite accept kakao-first CTA copy"
```

---

### Task 7: 환경·개발자 문서

**Files:**
- Modify: `.env.example`
- Modify: `docs/개발자가-처리할-항목.md`
- Modify: `docs/session-handoff-and-status.md` (§0)
- Modify: `docs/inferred-decisions-log.md` (구현 완료 시)

- [ ] **Step 1: `.env.example`** — spec §6 블록 추가

- [ ] **Step 2: 개발자 체크리스트** — Redirect URI 3줄 + 카카오 `account_email` Biz 앱 메모

- [ ] **Step 3: handoff §0** — “live OAuth 3종·약관·모바일 sign-in”

- [ ] **Step 4: Commit**

```bash
git add .env.example docs/개발자가-처리할-항목.md docs/session-handoff-and-status.md
git commit -m "docs: live OAuth env and developer checklist"
```

---

### Task 8: 전체 검증

- [ ] **Step 1: Automated**

```bash
npm run check && npm test && npm run lint && npm run build
```

Expected: all PASS

- [ ] **Step 2: Manual matrix (live + keys)**

| # | Steps |
|---|--------|
| 1 | `AUTH_MODE=mock` — sign-in에 소셜 없음, 기존 mock 안내 |
| 2 | `AUTH_MODE=live` + Kakao only env — 카카오 버튼만, 로그인 → accept-terms → `/` |
| 3 | invite flow — createInvite → accept URL → sign-in with inviteEmail → Kakao → accept membership |
| 4 | parent path — sign-in without inviteEmail — 소셜만 + 안내 문구 |

- [ ] **Step 3: inferred-decisions-log** — “구현 완료” + 검증 명령

- [ ] **Step 4: Commit if log only**

```bash
git add docs/inferred-decisions-log.md
git commit -m "docs: log live OAuth implementation complete"
```

---

## Spec coverage checklist

| Spec § | Task |
|--------|------|
| 소셜 3종 | Task 1–2, 5 |
| 모바일 sign-in | Task 5 |
| 약관 1회 | Task 3–4, 5 |
| 스태프 이메일 초대 | Task 5–6 (기존 플로) |
| inviteEmail 시 이메일·비번 | Task 5 |
| mock 분리 | Task 5 |
| env·체크리스트 | Task 7 |
| SMS·대기 | Out of scope |

## Self-review

- No TBD placeholders in tasks.
- `termsAcceptedAt` naming consistent across auth, terms-gate, accept-terms.
- `updateUser` headers: executor must pass `request.headers` from action — fix during Task 4 if types fail.
- Scope = single plan, one PR slice.
