import { fail } from '@sveltejs/kit';
import { withAcademyScope } from '$lib/server/academy-scope';
import { isPopulatedTeacherLean } from '$lib/server/mongo-populate-guards';
import { Course } from '$lib/server/models/course';
import { Enrollment } from '$lib/server/models/enrollment';
import { Teacher } from '$lib/server/models/teacher';
import { escapeRegex } from '$lib/server/mongo-util';
import { ensureDirectoryAccess, failFromGate, gateDirectoryAction } from '$lib/server/rbac';
import type { Actions, PageServerLoad } from './$types';

const MAX_NAME = 120;

function teacherLabel(t: { name: string; subject?: string | null }): string {
	const sub = t.subject?.trim();
	return sub ? `${t.name} (${sub})` : t.name;
}

export const load: PageServerLoad = async ({ url, locals }) => {
	ensureDirectoryAccess(locals);
	const q = url.searchParams.get('q')?.trim() ?? '';
	try {
		const { academyId } = await withAcademyScope();
		const teacherRows = await Teacher.find({ academyId }).sort({ name: 1 }).lean();
		const teachers = teacherRows.map((t) => ({
			id: t._id.toString(),
			label: teacherLabel({ name: t.name, subject: t.subject })
		}));

		const filter: Record<string, unknown> = { academyId };
		if (q.length > 0) filter.name = { $regex: escapeRegex(q), $options: 'i' };
		const rows = await Course.find(filter).populate('teacherId').sort({ name: 1 }).lean();

		const courses = rows.map((c) => {
			const pop = c.teacherId;
			const hasT = isPopulatedTeacherLean(pop);
			const teacherName = hasT ? teacherLabel(pop) : '—';
			const teacherId = hasT ? pop._id.toString() : '';
			return {
				id: c._id.toString(),
				name: c.name,
				teacherId,
				teacherName
			};
		});

		return { courses, teachers, q, dbError: null as string | null };
	} catch (e) {
		console.error('[courses load]', e);
		return {
			courses: [] as { id: string; name: string; teacherId: string; teacherName: string }[],
			teachers: [] as { id: string; label: string }[],
			q,
			dbError: 'MongoDB에 연결할 수 없습니다. DB를 띄우고 시드한 뒤 다시 시도하세요.'
		};
	}
};

function validateCourseName(name: string) {
	const n = name.trim();
	if (!n) return { error: '클래스 이름은 필수입니다.' as const };
	if (n.length > MAX_NAME) return { error: `이름은 ${MAX_NAME}자 이하로 입력하세요.` as const };
	return { name: n } as const;
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
		const v = validateCourseName(String(data.get('name') ?? ''));
		if ('error' in v) return fail(400, { error: v.error });
		const teacherId = String(data.get('teacherId') ?? '');
		if (!teacherId.match(/^[a-f\d]{24}$/i)) return fail(400, { error: '담당 강사를 선택하세요.' });
		const owns = await Teacher.exists({ _id: teacherId, academyId });
		if (!owns) return fail(400, { error: '선택한 강사가 이 학원에 없습니다.' });
		await Course.create({ academyId, name: v.name, teacherId });
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
		if (!id.match(/^[a-f\d]{24}$/i)) return fail(400, { error: '잘못된 클래스 ID입니다.' });
		const enrolled = await Enrollment.countDocuments({ academyId, courseId: id });
		if (enrolled > 0) {
			return fail(400, {
				error: `수강 등록이 ${enrolled}건 있어 삭제할 수 없습니다. 수강을 먼저 해제하세요.`
			});
		}
		const result = await Course.deleteOne({ _id: id, academyId });
		if (result.deletedCount === 0)
			return fail(404, { error: '해당 학원에서 클래스를 찾지 못했습니다.' });
		return { success: true as const };
	}
};
