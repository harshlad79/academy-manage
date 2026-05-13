import { error, fail, redirect } from '@sveltejs/kit';
import { withAcademyScope } from '$lib/server/academy-scope';
import { AcademyMembership } from '$lib/server/models/academy-membership';
import { ParentStudentLink } from '$lib/server/models/parent-student-link';
import { Student } from '$lib/server/models/student';
import { ensureDirectoryAccess, failFromGate, gateDirectoryAction } from '$lib/server/rbac';
import type { Actions, PageServerLoad } from './$types';

const MAX_NAME = 120;
const MAX_GRADE = 40;

function isOid(id: string): boolean {
	return /^[a-f\d]{24}$/i.test(id);
}

/** Better Auth user.id 의 안전 범위. 영문/숫자/일부 구분자 허용. */
const USER_ID_RE = /^[A-Za-z0-9._@:+-]{1,128}$/;

export const load: PageServerLoad = async ({ params, locals }) => {
	ensureDirectoryAccess(locals);
	if (!params.id || !isOid(params.id)) error(404, '학생을 찾을 수 없습니다.');
	try {
		const { academyId } = await withAcademyScope();
		const s = await Student.findOne({ _id: params.id, academyId }).lean();
		if (!s) error(404, '학생을 찾을 수 없습니다.');

		const parentMemberships = await AcademyMembership.find({ academyId, role: 'parent' })
			.select('userId')
			.sort({ userId: 1 })
			.lean();
		const links = await ParentStudentLink.find({ academyId, studentId: params.id })
			.sort({ createdAt: 1 })
			.lean();

		const linkedSet = new Set(links.map((l) => l.parentUserId));
		const linkedParents = links.map((l) => ({ parentUserId: l.parentUserId }));
		const candidateParents = parentMemberships
			.filter((m) => !linkedSet.has(m.userId))
			.map((m) => ({ parentUserId: m.userId }));

		return {
			student: {
				id: s._id.toString(),
				name: s.name,
				grade: s.grade ?? ''
			},
			linkedParents,
			candidateParents
		};
	} catch (e) {
		console.error('[student edit load]', e);
		error(503, '데이터베이스에 연결할 수 없습니다.');
	}
};

function validate(name: string, grade: string | undefined) {
	const n = name.trim();
	if (!n) return { error: '이름은 필수입니다.' as const };
	if (n.length > MAX_NAME) return { error: `이름은 ${MAX_NAME}자 이하로 입력하세요.` as const };
	const g = grade?.trim();
	if (g && g.length > MAX_GRADE)
		return { error: `학년은 ${MAX_GRADE}자 이하로 입력하세요.` as const };
	return { name: n, grade: g || undefined } as const;
}

export const actions: Actions = {
	update: async ({ request, params, locals }) => {
		const rg = gateDirectoryAction(locals);
		if (!rg.ok) return failFromGate(rg);
		if (!params.id || !isOid(params.id)) return fail(400, { error: '잘못된 ID입니다.' });
		let academyId;
		try {
			({ academyId } = await withAcademyScope());
		} catch {
			return fail(503, { error: 'DB에 연결할 수 없습니다.' });
		}
		const data = await request.formData();
		const v = validate(String(data.get('name') ?? ''), String(data.get('grade') ?? ''));
		if ('error' in v) return fail(400, { error: v.error });
		const result = await Student.updateOne(
			{ _id: params.id, academyId },
			{ $set: { name: v.name, grade: v.grade } }
		);
		if (result.matchedCount === 0) return fail(404, { error: '해당 학생을 찾지 못했습니다.' });
		redirect(303, '/students');
	},

	linkParent: async ({ request, params, locals }) => {
		const rg = gateDirectoryAction(locals);
		if (!rg.ok) return failFromGate(rg);
		if (!params.id || !isOid(params.id)) return fail(400, { error: '잘못된 학생 ID입니다.' });
		let academyId;
		try {
			({ academyId } = await withAcademyScope());
		} catch {
			return fail(503, { error: 'DB에 연결할 수 없습니다.' });
		}
		const data = await request.formData();
		const parentUserId = String(data.get('parentUserId') ?? '').trim();
		if (!parentUserId || !USER_ID_RE.test(parentUserId))
			return fail(400, { error: '학부모 계정을 선택하세요.' });

		const [studentExists, parentMember] = await Promise.all([
			Student.exists({ _id: params.id, academyId }),
			AcademyMembership.exists({ academyId, userId: parentUserId, role: 'parent' })
		]);
		if (!studentExists) return fail(404, { error: '해당 학생을 찾지 못했습니다.' });
		if (!parentMember)
			return fail(400, { error: '선택한 사용자는 이 학원의 학부모 계정이 아닙니다.' });

		try {
			await ParentStudentLink.create({
				academyId,
				parentUserId,
				studentId: params.id
			});
		} catch (e) {
			if (
				typeof e === 'object' &&
				e !== null &&
				'code' in e &&
				(e as { code: unknown }).code === 11000
			) {
				return fail(400, { error: '이미 연결된 학부모입니다.' });
			}
			throw e;
		}
		return { success: true as const };
	},

	unlinkParent: async ({ request, params, locals }) => {
		const rg = gateDirectoryAction(locals);
		if (!rg.ok) return failFromGate(rg);
		if (!params.id || !isOid(params.id)) return fail(400, { error: '잘못된 학생 ID입니다.' });
		let academyId;
		try {
			({ academyId } = await withAcademyScope());
		} catch {
			return fail(503, { error: 'DB에 연결할 수 없습니다.' });
		}
		const data = await request.formData();
		const parentUserId = String(data.get('parentUserId') ?? '').trim();
		if (!parentUserId || !USER_ID_RE.test(parentUserId))
			return fail(400, { error: '잘못된 학부모 식별자입니다.' });
		const result = await ParentStudentLink.deleteOne({
			academyId,
			studentId: params.id,
			parentUserId
		});
		if (result.deletedCount === 0) return fail(404, { error: '연결된 학부모를 찾지 못했습니다.' });
		return { success: true as const };
	}
};
