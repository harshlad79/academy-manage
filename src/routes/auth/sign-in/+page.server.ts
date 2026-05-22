import { env } from '$env/dynamic/private';
import { isMockAuthMode, listEnabledSocialProviders } from '$lib/server/auth';
import { sanitizeInviteCallbackURL, splitAppPath } from '$lib/server/invite-return';
import { mockUserIdForInviteEmail } from '$lib/server/mock-invite-auth';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ url }) => {
	const callbackURL = sanitizeInviteCallbackURL(url.searchParams.get('callbackURL'), url.origin);
	const callbackParts = splitAppPath(callbackURL);
	const inviteEmailRaw = url.searchParams.get('inviteEmail')?.trim() ?? '';
	const inviteEmail = inviteEmailRaw.length > 0 ? inviteEmailRaw : null;
	const isMock = isMockAuthMode();
	const mockUserId = inviteEmail ? mockUserIdForInviteEmail(inviteEmail) : null;
	return {
		callbackPathname: callbackParts.pathname,
		callbackSearch: callbackParts.search,
		callbackToken:
			callbackParts.pathname === '/invite/accept'
				? (new URLSearchParams(callbackParts.search.replace(/^\?/, '')).get('token') ?? '')
				: '',
		inviteEmail,
		isMock,
		liveSocial: !isMock
			? listEnabledSocialProviders({
					KAKAO_CLIENT_ID: env.KAKAO_CLIENT_ID,
					KAKAO_CLIENT_SECRET: env.KAKAO_CLIENT_SECRET,
					NAVER_CLIENT_ID: env.NAVER_CLIENT_ID,
					NAVER_CLIENT_SECRET: env.NAVER_CLIENT_SECRET,
					GOOGLE_CLIENT_ID: env.GOOGLE_CLIENT_ID,
					GOOGLE_CLIENT_SECRET: env.GOOGLE_CLIENT_SECRET
				})
			: [],
		mockUserId,
		mockProfiles: isMock
			? [
					{ id: 'superadmin', email: 'superadmin@example.com' },
					{ id: 'testuser', email: 'test@example.com' },
					{ id: 'parent-kim', email: 'parent-kim@example.com' }
				]
			: []
	};
};
