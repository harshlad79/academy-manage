import { fail } from '@sveltejs/kit';
import { withAcademyScope } from '$lib/server/academy-scope';
import { Course } from '$lib/server/models/course';
import { Teacher } from '$lib/server/models/teacher';
import { escapeRegex } from '$lib/server/mongo-util';
import { ensureDirectoryAccess, failFromGate, gateDirectoryAction } from '$lib/server/rbac';
import type { Actions, PageServerLoad } from './$types';

const MAX_NAME = 120;
const MAX_SUBJECT = 80;

export const load: PageServerLoad = async ({ url, locals }) => {
	ensureDirectoryAccess(locals);
	const q = url.searchParams.get('q')?.trim() ?? '';
	try {
		const { academyId } = await withAcademyScope();
		const filter: Record<string, unknown> = { academyId };
		if (q.length > 0) filter.name = { $regex: escapeRegex(q), $options: 'i' };
		const rows = await Teacher.find(filter).sort({ name: 1 }).lean();
		return {
			teachers: rows.map((t) => ({
				id: t._id.toString(),
				name: t.name,
				subject: t.subject ?? null
			})),
			q,
			dbError: null as string | null
		};
	} catch (e) {
		console.error('[teachers load]', e);
		return {
			teachers: [] as { id: string; name: string; subject: string | null }[],
			q,
			dbError: 'MongoDB에 연결할 수 없습니다. DB를 띄우고 시드한 뒤 다시 시도하세요.'
		};
	}
};

function validateTeacher(name: string, subject: string | undefined) {
	const n = name.trim();
	if (!n) return { error: '이름은 필수입니다.' as const };
	if (n.length > MAX_NAME) return { error: `이름은 ${MAX_NAME}자 이하로 입력하세요.` as const };
	const s = subject?.trim();
	if (s && s.length > MAX_SUBJECT)
		return { error: `담당 과목은 ${MAX_SUBJECT}자 이하로 입력하세요.` as const };
	return { name: n, subject: s || undefined } as const;
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
		const v = validateTeacher(String(data.get('name') ?? ''), String(data.get('subject') ?? ''));
		if ('error' in v) return fail(400, { error: v.error });
		await Teacher.create({ academyId, name: v.name, subject: v.subject });
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
		if (!id.match(/^[a-f\d]{24}$/i)) return fail(400, { error: '잘못된 강사 ID입니다.' });
		const tied = await Course.countDocuments({ academyId, teacherId: id });
		if (tied > 0) {
			return fail(400, {
				error: `담당 클래스가 ${tied}개 있어 삭제할 수 없습니다. 클래스를 먼저 옮기거나 삭제하세요.`
			});
		}
		const result = await Teacher.deleteOne({ _id: id, academyId });
		if (result.deletedCount === 0)
			return fail(404, { error: '해당 학원에서 강사를 찾지 못했습니다.' });
		return { success: true as const };
	}
};
