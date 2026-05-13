import { fail, redirect } from '@sveltejs/kit';
import { Types } from 'mongoose';
import { isOidHex } from '$lib/server/active-academy';
import connectDB from '$lib/server/db';
import { getDefaultAcademyId } from '$lib/server/dev-academy';
import { Academy } from '$lib/server/models/academy';
import { AcademyMembership } from '$lib/server/models/academy-membership';
import { ensurePlatformSuperAdmin } from '$lib/server/rbac';
import type { Actions, PageServerLoad } from './$types';

const MAX_ACADEMY_NAME = 120;

export const load: PageServerLoad = async ({ locals }) => {
	ensurePlatformSuperAdmin(locals);
	const defaultAcademyIdHex = getDefaultAcademyId().toHexString();

	try {
		await connectDB();
		const rows = await Academy.find({}).sort({ name: 1 }).limit(200).lean();
		return {
			defaultAcademyIdHex,
			rows: rows.map((r) => ({
				id: r._id.toString(),
				name: r.name,
				status: r.status
			})),
			dbError: null as string | null
		};
	} catch (e) {
		console.error('[platform/academies load]', e);
		return {
			defaultAcademyIdHex,
			rows: [] as { id: string; name: string; status: string }[],
			dbError: '학원 목록을 불러오지 못했습니다.'
		};
	}
};

export const actions: Actions = {
	createAcademy: async ({ request, locals }) => {
		ensurePlatformSuperAdmin(locals);
		const fd = await request.formData();
		const name = fd.get('name')?.toString()?.trim() ?? '';
		if (!name || name.length > MAX_ACADEMY_NAME) {
			return fail(400, { error: '학원 이름을 1~120자로 입력하세요.' });
		}
		await connectDB();
		const doc = await Academy.create({ name, status: 'active' });
		await AcademyMembership.create({
			userId: locals.user!.id,
			academyId: doc._id,
			role: 'super_admin'
		});
		redirect(303, '/platform/academies');
	},
	deactivateAcademy: async ({ request, locals }) => {
		ensurePlatformSuperAdmin(locals);
		const fd = await request.formData();
		const idRaw = fd.get('academyId')?.toString()?.trim();
		if (!idRaw || !isOidHex(idRaw)) return fail(400, { error: '잘못된 학원 ID입니다.' });
		const id = new Types.ObjectId(idRaw);
		if (id.equals(getDefaultAcademyId())) {
			return fail(400, { error: '개발 기본 학원(DEV_ACADEMY_ID)은 비활성화할 수 없습니다.' });
		}
		await connectDB();
		await Academy.updateOne({ _id: id }, { $set: { status: 'inactive' } });
		redirect(303, '/platform/academies');
	},
	reactivateAcademy: async ({ request, locals }) => {
		ensurePlatformSuperAdmin(locals);
		const fd = await request.formData();
		const idRaw = fd.get('academyId')?.toString()?.trim();
		if (!idRaw || !isOidHex(idRaw)) return fail(400, { error: '잘못된 학원 ID입니다.' });
		const id = new Types.ObjectId(idRaw);
		await connectDB();
		await Academy.updateOne({ _id: id }, { $set: { status: 'active' } });
		redirect(303, '/platform/academies');
	}
};
