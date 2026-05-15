import { isMockAuthMode } from '$lib/server/auth';
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
