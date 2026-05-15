/** 초대 수락 후 복귀 URL — 동일 origin·`/invite/accept` 만 허용. */
export function sanitizeInviteCallbackURL(
	raw: string | null | undefined,
	requestOrigin: string
): string {
	const fallback = '/invite/accept';
	const trimmed = raw?.trim();
	if (!trimmed) return fallback;
	try {
		const base = new URL(requestOrigin);
		const parsed = new URL(trimmed, base);
		if (parsed.origin !== base.origin) return fallback;
		const path = `${parsed.pathname}${parsed.search}`;
		if (!parsed.pathname.startsWith('/invite/accept')) return fallback;
		return path;
	} catch {
		return fallback;
	}
}

export function buildInviteAcceptReturnPath(token: string): string {
	return `/invite/accept?token=${encodeURIComponent(token)}`;
}

export function buildInviteAuthSignInPath(returnPath: string, inviteEmail?: string): string {
	const q = new URLSearchParams({ callbackURL: returnPath });
	if (inviteEmail) q.set('inviteEmail', inviteEmail);
	return `/auth/sign-in?${q.toString()}`;
}

export function buildInviteAuthSignInSearch(returnPath: string, inviteEmail?: string): string {
	const q = new URLSearchParams({ callbackURL: returnPath });
	if (inviteEmail) q.set('inviteEmail', inviteEmail);
	const s = q.toString();
	return s ? `?${s}` : '';
}

/** 앱 내부 경로를 pathname + search 로 분리 (`resolve()` 용). */
export function splitAppPath(fullPath: string): { pathname: string; search: string } {
	const i = fullPath.indexOf('?');
	if (i === -1) return { pathname: fullPath, search: '' };
	return { pathname: fullPath.slice(0, i), search: fullPath.slice(i) };
}
