import { Types } from 'mongoose';

import { AcademyMembership } from '$lib/server/models/academy-membership';
import { Teacher } from '$lib/server/models/teacher';

/** `createInvite` 시 `assertTeacherLinkValid` 의 `excludeUserId` 용 배제 문자열 */
export const TEACHER_INVITE_PENDING_USER_ID = '__invite_pending__';

export async function assertTeacherLinkValid(
	academyId: Types.ObjectId,
	teacherOid: Types.ObjectId,
	excludeUserId: string
): Promise<{ ok: true } | { ok: false; error: string }> {
	const t = await Teacher.findOne({ _id: teacherOid, academyId }).select('_id').lean();
	if (!t) {
		return { ok: false, error: '해당 학원에 속한 강사(Teacher)가 아닙니다.' };
	}
	const dup = await AcademyMembership.exists({
		academyId,
		linkedTeacherId: teacherOid,
		userId: { $ne: excludeUserId }
	});
	if (dup) {
		return { ok: false, error: '이미 다른 계정에 연결된 강사 프로필입니다.' };
	}
	return { ok: true };
}
