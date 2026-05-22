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
