import { fail, redirect } from '@sveltejs/kit';

import connectDB from '$lib/server/db';
import {
	AcademyInquiry,
	validateAcademyInquiryCreateInput,
	type AcademyInquiryCreateInput
} from '$lib/server/models/academy-inquiry';
import type { Actions, PageServerLoad } from './$types';

export const load: PageServerLoad = async () => ({});

function formStr(fd: FormData, key: string): string {
	return fd.get(key)?.toString().trim() ?? '';
}

function readFormInput(fd: FormData): AcademyInquiryCreateInput {
	return {
		academyName: formStr(fd, 'academyName'),
		contactName: formStr(fd, 'contactName'),
		phone: formStr(fd, 'phone'),
		email: formStr(fd, 'email'),
		region: formStr(fd, 'region'),
		memo: formStr(fd, 'memo')
	};
}

export const actions: Actions = {
	default: async ({ request }) => {
		const input = readFormInput(await request.formData());
		const validated = validateAcademyInquiryCreateInput(input);
		if (!validated.ok) {
			return fail(400, { error: validated.error, values: input });
		}

		try {
			await connectDB();
			await AcademyInquiry.create({
				...validated.fields,
				status: 'new'
			});
		} catch (e) {
			console.error('[academy-inquiry]', e);
			return fail(500, {
				error: '문의 접수에 실패했습니다. 잠시 후 다시 시도해 주세요.',
				values: input
			});
		}

		redirect(303, '/academy-inquiry/success');
	}
};
