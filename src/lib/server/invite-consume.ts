import { Types } from 'mongoose';

import { isMockAuthMode, liveBetterAuthUserExists } from '$lib/server/auth';
import { AcademyInvite, normalizeInviteEmail } from '$lib/server/models/academy-invite';
import { AcademyMembership } from '$lib/server/models/academy-membership';
import { assertTeacherLinkValid } from '$lib/server/teacher-membership-link';

export type ConsumeInviteResult =
	| { ok: true; academyIdHex: string }
	| {
			ok: false;
			code:
				| 'missing_token'
				| 'no_session_email'
				| 'invalid'
				| 'expired'
				| 'email_mismatch'
				| 'dup_membership'
				| 'teacher_link'
				| 'live_user_missing';
			message?: string;
	  };

export function consumeInviteFailureMessage(
	r: Extract<ConsumeInviteResult, { ok: false }>
): string {
	switch (r.code) {
		case 'missing_token':
			return '초대 토큰이 없습니다.';
		case 'no_session_email':
			return '계정에 이메일이 없어 초대를 수락할 수 없습니다.';
		case 'invalid':
			return '유효하지 않거나 이미 처리된 초대입니다.';
		case 'expired':
			return '초대가 만료되었습니다.';
		case 'email_mismatch':
			return '로그인한 계정 이메일이 이 초대와 일치하지 않습니다.';
		case 'dup_membership':
			return '이미 이 학원에 대한 멤버십이 있습니다.';
		case 'teacher_link':
			return r.message ?? '강사 프로필 연결을 확인할 수 없습니다.';
		case 'live_user_missing':
			return 'Better Auth에 등록된 사용자가 아닙니다.';
		default:
			return '초대를 처리할 수 없습니다.';
	}
}

/**
 * 로그인 세션 사용자가 초대 토큰을 수락해 `AcademyMembership` 을 만든다.
 * 이메일은 초대에 기록된 값과 세션 `user.email` 정규화 비교로만 검증한다.
 */
export async function consumeAcademyInviteForLoggedInUser(
	tokenRaw: string,
	userId: string,
	userEmailRaw: string | null | undefined
): Promise<ConsumeInviteResult> {
	const token = tokenRaw.trim();
	if (!token) {
		return { ok: false, code: 'missing_token' };
	}
	const sessionEmail = normalizeInviteEmail(userEmailRaw ?? '');
	if (!sessionEmail) {
		return { ok: false, code: 'no_session_email' };
	}
	const inv = await AcademyInvite.findOne({ token }).lean();
	if (!inv) {
		return { ok: false, code: 'invalid' };
	}
	if (inv.expiresAt.getTime() < Date.now()) {
		return { ok: false, code: 'expired' };
	}
	if (inv.email !== sessionEmail) {
		return { ok: false, code: 'email_mismatch' };
	}
	if (!isMockAuthMode()) {
		const exists = await liveBetterAuthUserExists(userId);
		if (!exists) {
			return { ok: false, code: 'live_user_missing' };
		}
	}
	const academyId = inv.academyId as Types.ObjectId;
	const dup = await AcademyMembership.exists({ userId, academyId });
	if (dup) {
		return { ok: false, code: 'dup_membership' };
	}
	let linkedTeacherId: Types.ObjectId | undefined;
	if (inv.role === 'teacher' && inv.linkedTeacherId) {
		const tid = inv.linkedTeacherId as Types.ObjectId;
		const chk = await assertTeacherLinkValid(academyId, tid, userId);
		if (!chk.ok) {
			return { ok: false, code: 'teacher_link', message: chk.error };
		}
		linkedTeacherId = tid;
	}
	await AcademyMembership.create({
		userId,
		academyId,
		role: inv.role,
		...(linkedTeacherId ? { linkedTeacherId } : {})
	});
	await AcademyInvite.deleteOne({ _id: inv._id });
	return { ok: true, academyIdHex: academyId.toHexString() };
}
