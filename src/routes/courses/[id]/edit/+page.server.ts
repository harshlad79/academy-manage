import { error, fail, redirect } from '@sveltejs/kit';
import { withAcademyScope } from '$lib/server/academy-scope';
import { Course } from '$lib/server/models/course';
import { Teacher } from '$lib/server/models/teacher';
import { ensureDirectoryAccess, failFromGate, gateDirectoryAction } from '$lib/server/rbac';
import type { Actions, PageServerLoad } from './$types';

const MAX_NAME = 120;

function teacherLabel(t: { name: string; subject?: string | null }): string {
	const sub = t.subject?.trim();
	return sub ? `${t.name} (${sub})` : t.name;
}

export const load: PageServerLoad = async ({ params, locals }) => {
	ensureDirectoryAccess(locals);
	if (!params.id?.match(/^[a-f\d]{24}$/i)) error(404, '클래스를 찾을 수 없습니다.');
	try {
		const { academyId } = await withAcademyScope();
		const c = await Course.findOne({ _id: params.id, academyId }).lean();
		if (!c) error(404, '클래스를 찾을 수 없습니다.');
		const teacherRows = await Teacher.find({ academyId }).sort({ name: 1 }).lean();
		const teachers = teacherRows.map((t) => ({
			id: t._id.toString(),
			label: teacherLabel({ name: t.name, subject: t.subject })
		}));
		return {
			course: {
				id: c._id.toString(),
				name: c.name,
				teacherId: c.teacherId.toString()
			},
			teachers
		};
	} catch (e) {
		console.error('[course edit load]', e);
		error(503, '데이터베이스에 연결할 수 없습니다.');
	}
};

function validateCourseName(name: string) {
	const n = name.trim();
	if (!n) return { error: '클래스 이름은 필수입니다.' as const };
	if (n.length > MAX_NAME) return { error: `이름은 ${MAX_NAME}자 이하로 입력하세요.` as const };
	return { name: n } as const;
}

export const actions: Actions = {
	update: async ({ request, params, locals }) => {
		const rg = gateDirectoryAction(locals);
		if (!rg.ok) return failFromGate(rg);
		if (!params.id?.match(/^[a-f\d]{24}$/i)) return fail(400, { error: '잘못된 ID입니다.' });
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
		const result = await Course.updateOne(
			{ _id: params.id, academyId },
			{ $set: { name: v.name, teacherId } }
		);
		if (result.matchedCount === 0) return fail(404, { error: '해당 클래스를 찾지 못했습니다.' });
		redirect(303, '/courses');
	}
};
