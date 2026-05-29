import { error, fail, redirect } from '@sveltejs/kit';
import { Types } from 'mongoose';

import { isOidHex } from '$lib/server/active-academy';
import connectDB from '$lib/server/db';
import { Academy } from '$lib/server/models/academy';
import { normalizeInvitePhone } from '$lib/server/models/academy-invite';
import { Lead } from '$lib/server/models/lead';
import type { Actions, PageServerLoad } from './$types';

export type ApplyFormValues = {
	studentName: string;
	guardianName: string;
	phone: string;
	memo?: string;
};

function isAllowedAcademyStatus(status: string): status is 'trial' | 'active' {
	return status === 'trial' || status === 'active';
}

async function findApplyAcademy(
	academyIdHex: string
): Promise<{ academyId: string; academyName: string } | null> {
	if (!academyIdHex || !isOidHex(academyIdHex)) return null;

	await connectDB();
	const academy = await Academy.findById(academyIdHex).select('name status').lean();
	if (!academy || !isAllowedAcademyStatus(academy.status)) return null;

	return { academyId: academyIdHex, academyName: academy.name };
}

function formStr(fd: FormData, key: string): string {
	return fd.get(key)?.toString().trim() ?? '';
}

function readFormValues(fd: FormData): ApplyFormValues {
	return {
		studentName: formStr(fd, 'studentName'),
		guardianName: formStr(fd, 'guardianName'),
		phone: formStr(fd, 'phone'),
		memo: formStr(fd, 'memo')
	};
}

function validateApplyInput(
	values: ApplyFormValues
): { ok: true; fields: { studentName: string; guardianName: string; phone: string; memo?: string } } | { ok: false; error: string } {
	const studentName = values.studentName.trim();
	const guardianName = values.guardianName.trim();
	if (!studentName) return { ok: false, error: '학생(자녀) 이름을 입력하세요.' };
	if (!guardianName) return { ok: false, error: '보호자명을 입력하세요.' };

	const phone = normalizeInvitePhone(values.phone);
	if (!phone) return { ok: false, error: '유효한 휴대번호(010)를 입력하세요.' };

	const memo = values.memo?.trim();
	return {
		ok: true,
		fields: {
			studentName,
			guardianName,
			phone,
			...(memo ? { memo } : {})
		}
	};
}

export const load: PageServerLoad = async ({ url }) => {
	const academyIdHex = url.searchParams.get('a')?.trim() ?? '';
	const academy = await findApplyAcademy(academyIdHex);
	if (!academy) error(404, '학원을 찾을 수 없습니다.');
	return academy;
};

export const actions: Actions = {
	default: async ({ request }) => {
		const fd = await request.formData();
		const academyIdHex = formStr(fd, 'academyId');
		const values = readFormValues(fd);

		const academy = await findApplyAcademy(academyIdHex);
		if (!academy) {
			return fail(400, {
				error: '유효하지 않은 학원입니다. 링크를 다시 확인해 주세요.',
				values,
				academyId: academyIdHex
			});
		}

		const validated = validateApplyInput(values);
		if (!validated.ok) {
			return fail(400, {
				error: validated.error,
				values,
				academyId: academy.academyId,
				academyName: academy.academyName
			});
		}

		try {
			await connectDB();
			await Lead.create({
				academyId: new Types.ObjectId(academy.academyId),
				...validated.fields,
				source: 'web',
				status: 'new'
			});
		} catch (e) {
			console.error('[apply]', e);
			return fail(500, {
				error: '신청 접수에 실패했습니다. 잠시 후 다시 시도해 주세요.',
				values,
				academyId: academy.academyId,
				academyName: academy.academyName
			});
		}

		redirect(303, '/apply/success');
	}
};
