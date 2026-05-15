import { fail, redirect } from '@sveltejs/kit';

import { buildInviteAcceptReturnPath } from '$lib/server/invite-return';
import { isMockAuthMode } from '$lib/server/auth';
import { mockUserIdForInviteEmail } from '$lib/server/mock-invite-auth';
import connectDB from '$lib/server/db';
import {
	consumeAcademyInviteForLoggedInUser,
	consumeInviteFailureMessage
} from '$lib/server/invite-consume';
import { Academy } from '$lib/server/models/academy';
import {
	AcademyInvite,
	normalizeInviteEmail,
	type AcademyInviteRole
} from '$lib/server/models/academy-invite';
import type { Actions, PageServerLoad } from './$types';

type AcceptUi = 'can_accept' | 'need_login' | 'email_mismatch' | 'no_session_email';

function resolveAcceptUi(user: App.Locals['user'], inviteEmail: string): AcceptUi {
	if (!user) return 'need_login';
	const n = normalizeInviteEmail(user.email ?? '');
	if (!n) return 'no_session_email';
	if (n !== inviteEmail) return 'email_mismatch';
	return 'can_accept';
}

export const load: PageServerLoad = async ({ url, locals }) => {
	const token = url.searchParams.get('token')?.trim() ?? '';
	if (!token) {
		return { kind: 'missing' as const };
	}
	await connectDB();
	const inv = await AcademyInvite.findOne({ token }).lean();
	if (!inv) {
		return { kind: 'invalid' as const };
	}
	if (inv.expiresAt.getTime() < Date.now()) {
		return { kind: 'expired' as const, email: inv.email };
	}
	const academy = await Academy.findById(inv.academyId).select('name status').lean();
	const acceptUi = resolveAcceptUi(locals.user, inv.email);
	const returnPath = buildInviteAcceptReturnPath(token);
	return {
		kind: 'ok' as const,
		token,
		email: inv.email,
		role: inv.role as AcademyInviteRole,
		academyName: academy?.name ?? '학원',
		academyStatus: academy?.status ?? 'unknown',
		acceptUi,
		inviteReturnPath: returnPath,
		isMockAuth: isMockAuthMode(),
		mockUserIdHint: isMockAuthMode() ? mockUserIdForInviteEmail(inv.email) : null
	};
};

export const actions: Actions = {
	acceptInvite: async ({ request, locals }) => {
		const uid = locals.user?.id;
		if (!uid) {
			return fail(401, { error: '로그인이 필요합니다.' });
		}
		const fd = await request.formData();
		const token = fd.get('token')?.toString() ?? '';
		await connectDB();
		const result = await consumeAcademyInviteForLoggedInUser(token, uid, locals.user?.email);
		if (!result.ok) {
			return fail(400, { error: consumeInviteFailureMessage(result) });
		}
		redirect(303, '/');
	}
};
