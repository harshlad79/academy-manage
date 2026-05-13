import { error, fail, redirect } from '@sveltejs/kit';
import { withAcademyScope } from '$lib/server/academy-scope';
import { Teacher } from '$lib/server/models/teacher';
import { ensureDirectoryAccess, failFromGate, gateDirectoryAction } from '$lib/server/rbac';
import type { Actions, PageServerLoad } from './$types';

const MAX_NAME = 120;
const MAX_SUBJECT = 80;

export const load: PageServerLoad = async ({ params, locals }) => {
	ensureDirectoryAccess(locals);
	if (!params.id?.match(/^[a-f\d]{24}$/i)) error(404, '강사를 찾을 수 없습니다.');
	try {
		const { academyId } = await withAcademyScope();
		const t = await Teacher.findOne({ _id: params.id, academyId }).lean();
		if (!t) error(404, '강사를 찾을 수 없습니다.');
		return {
			teacher: {
				id: t._id.toString(),
				name: t.name,
				subject: t.subject ?? ''
			}
		};
	} catch (e) {
		console.error('[teacher edit load]', e);
		error(503, '데이터베이스에 연결할 수 없습니다.');
	}
};

function validate(name: string, subject: string | undefined) {
	const n = name.trim();
	if (!n) return { error: '이름은 필수입니다.' as const };
	if (n.length > MAX_NAME) return { error: `이름은 ${MAX_NAME}자 이하로 입력하세요.` as const };
	const s = subject?.trim();
	if (s && s.length > MAX_SUBJECT)
		return { error: `담당 과목은 ${MAX_SUBJECT}자 이하로 입력하세요.` as const };
	return { name: n, subject: s || undefined } as const;
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
		const v = validate(String(data.get('name') ?? ''), String(data.get('subject') ?? ''));
		if ('error' in v) return fail(400, { error: v.error });
		const result = await Teacher.updateOne(
			{ _id: params.id, academyId },
			{ $set: { name: v.name, subject: v.subject } }
		);
		if (result.matchedCount === 0) return fail(404, { error: '해당 강사를 찾지 못했습니다.' });
		redirect(303, '/teachers');
	}
};
