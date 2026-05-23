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
