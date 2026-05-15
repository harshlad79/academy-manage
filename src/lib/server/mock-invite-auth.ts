import { normalizeInviteEmail } from '$lib/server/models/academy-invite';

/** `auth.ts` MOCK_USER_PROFILES 와 동기 유지. */
export const MOCK_INVITE_AUTH_PROFILES: { id: string; name: string; email: string }[] = [
	{ id: 'superadmin', name: '전체관리자(목업)', email: 'superadmin@example.com' },
	{ id: 'testuser', name: '테스트 사용자', email: 'test@example.com' },
	{ id: 'parent-kim', name: '김 학부모', email: 'parent-kim@example.com' }
];

export function mockUserIdForInviteEmail(rawEmail: string): string | null {
	const n = normalizeInviteEmail(rawEmail);
	if (!n) return null;
	for (const p of MOCK_INVITE_AUTH_PROFILES) {
		if (p.email === n) return p.id;
	}
	return null;
}
