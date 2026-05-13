import { fail } from '@sveltejs/kit';
import { withAcademyScope } from '$lib/server/academy-scope';
import { Enrollment } from '$lib/server/models/enrollment';
import { ParentStudentLink } from '$lib/server/models/parent-student-link';
import { Student } from '$lib/server/models/student';
import { escapeRegex } from '$lib/server/mongo-util';
import { ensureDirectoryAccess, failFromGate, gateDirectoryAction } from '$lib/server/rbac';
import type { Actions, PageServerLoad } from './$types';

const MAX_NAME = 120;
const MAX_GRADE = 40;

export const load: PageServerLoad = async ({ url, locals }) => {
	ensureDirectoryAccess(locals);
	const q = url.searchParams.get('q')?.trim() ?? '';
	try {
		const { academyId } = await withAcademyScope();
		const filter: Record<string, unknown> = { academyId };
		if (q.length > 0) {
			filter.name = { $regex: escapeRegex(q), $options: 'i' };
		}
		const rows = await Student.find(filter).sort({ name: 1 }).lean();
		return {
			students: rows.map((s) => ({
				id: s._id.toString(),
				name: s.name,
				grade: s.grade ?? null
			})),
			q,
			dbError: null as string | null
		};
	} catch (e) {
		console.error('[students load]', e);
		return {
			students: [] as { id: string; name: string; grade: string | null }[],
			q,
			dbError: 'MongoDB에 연결할 수 없습니다. DB를 띄우고 시드한 뒤 다시 시도하세요.'
		};
	}
};

function validateNameGrade(name: string, grade: string | undefined) {
	const n = name.trim();
	if (!n) return { error: '이름은 필수입니다.' as const };
	if (n.length > MAX_NAME) return { error: `이름은 ${MAX_NAME}자 이하로 입력하세요.` as const };
	const g = grade?.trim();
	if (g && g.length > MAX_GRADE)
		return { error: `학년은 ${MAX_GRADE}자 이하로 입력하세요.` as const };
	return { name: n, grade: g || undefined } as const;
}

export const actions: Actions = {
	create: async ({ request, locals }) => {
		const rg = gateDirectoryAction(locals);
		if (!rg.ok) return failFromGate(rg);
		let academyId;
		try {
			({ academyId } = await withAcademyScope());
		} catch {
			return fail(503, { error: 'DB에 연결할 수 없습니다.' });
		}
		const data = await request.formData();
		const rawName = String(data.get('name') ?? '');
		const rawGrade = String(data.get('grade') ?? '');
		const v = validateNameGrade(rawName, rawGrade);
		if ('error' in v) return fail(400, { error: v.error });
		await Student.create({ academyId, name: v.name, grade: v.grade });
		return { success: true as const };
	},

	delete: async ({ request, locals }) => {
		const rg = gateDirectoryAction(locals);
		if (!rg.ok) return failFromGate(rg);
		let academyId;
		try {
			({ academyId } = await withAcademyScope());
		} catch {
			return fail(503, { error: 'DB에 연결할 수 없습니다.' });
		}
		const data = await request.formData();
		const id = String(data.get('id') ?? '');
		if (!id.match(/^[a-f\d]{24}$/i)) return fail(400, { error: '잘못된 학생 ID입니다.' });
		const enrolled = await Enrollment.countDocuments({ academyId, studentId: id });
		if (enrolled > 0) {
			return fail(400, {
				error: `등록된 수강이 ${enrolled}건 있어 삭제할 수 없습니다. 수강을 먼저 해제하세요.`
			});
		}
		await ParentStudentLink.deleteMany({ academyId, studentId: id });
		const result = await Student.deleteOne({ _id: id, academyId });
		if (result.deletedCount === 0)
			return fail(404, { error: '해당 학원에서 학생을 찾지 못했습니다.' });
		return { success: true as const };
	}
};
