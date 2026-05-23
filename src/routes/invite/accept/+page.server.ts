import { fail, redirect } from '@sveltejs/kit';

import { buildInviteAcceptReturnPath } from '$lib/server/invite-return';
import { isMockAuthMode } from '$lib/server/auth';
import {
	consumeAcademyInviteForLoggedInUser,
	consumeInviteFailureMessage,
	invitePhoneLast4,
	resolveInviteAcceptUi
} from '$lib/server/invite-consume';
import { mockUserIdForInviteEmail } from '$lib/server/mock-invite-auth';
import connectDB from '$lib/server/db';
import { Academy } from '$lib/server/models/academy';
import { AcademyInvite, type AcademyInviteRole } from '$lib/server/models/academy-invite';
import type { Actions, PageServerLoad } from './$types';

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
	const role = inv.role as AcademyInviteRole;
	const isParentInvite = role === 'parent';
	if (inv.expiresAt.getTime() < Date.now()) {
		return {
			kind: 'expired' as const,
			isParentInvite,
			email: inv.email ?? null,
			phoneLast4: invitePhoneLast4(inv.phone)
		};
	}
	const academy = await Academy.findById(inv.academyId).select('name status').lean();
	const acceptUi = resolveInviteAcceptUi(locals.user, { role, email: inv.email });
	const returnPath = buildInviteAcceptReturnPath(token);
	return {
		kind: 'ok' as const,
		token,
		isParentInvite,
		email: inv.email ?? null,
		phoneLast4: invitePhoneLast4(inv.phone),
		role,
		academyName: academy?.name ?? '학원',
		academyStatus: academy?.status ?? 'unknown',
		acceptUi,
		inviteReturnPath: returnPath,
		isMockAuth: isMockAuthMode(),
		mockUserIdHint: isMockAuthMode() && inv.email ? mockUserIdForInviteEmail(inv.email) : null
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
		const invBefore = await AcademyInvite.findOne({ token: token.trim() }).lean();
		const result = await consumeAcademyInviteForLoggedInUser(token, uid, locals.user?.email);
		if (!result.ok) {
			return fail(400, { error: consumeInviteFailureMessage(result) });
		}
		redirect(303, invBefore?.role === 'parent' ? '/p' : '/');
	}
};
