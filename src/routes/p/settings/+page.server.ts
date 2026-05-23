import { error, fail, redirect } from '@sveltejs/kit';
import { betterAuth } from 'better-auth';
import { env } from '$env/dynamic/private';
import { MongoClient } from 'mongodb';
import { getAuth, isMockAuthMode } from '$lib/server/auth';
import { normalizeInvitePhone } from '$lib/server/models/academy-invite';
import type { Actions, PageServerLoad } from './$types';

type ProfileFields = {
	phone?: string | null;
	smsMarketingConsentAt?: Date | null;
};

async function readProfileLive(userId: string): Promise<ProfileFields> {
	const url = env.DB_URL?.trim();
	if (!url) return {};
	const client = new MongoClient(url);
	try {
		const doc = await client
			.db('academy-db')
			.collection('user')
			.findOne(
				{ $or: [{ id: userId }, { userId }] },
				{ projection: { phone: 1, smsMarketingConsentAt: 1 } }
			);
		return {
			phone: typeof doc?.phone === 'string' ? doc.phone : null,
			smsMarketingConsentAt:
				doc?.smsMarketingConsentAt instanceof Date ? doc.smsMarketingConsentAt : null
		};
	} finally {
		await client.close();
	}
}

async function writeProfileLive(userId: string, fields: ProfileFields): Promise<void> {
	const url = env.DB_URL?.trim();
	if (!url) throw new Error('DB_URL required');
	const client = new MongoClient(url);
	try {
		const result = await client
			.db('academy-db')
			.collection('user')
			.updateOne(
				{ $or: [{ id: userId }, { userId }] },
				{ $set: { ...fields, updatedAt: new Date() } }
			);
		if (result.matchedCount === 0) throw new Error('user not found');
	} finally {
		await client.close();
	}
}

async function saveProfile(
	headers: Headers,
	userId: string,
	body: Record<string, unknown>
): Promise<void> {
	const auth = getAuth() as ReturnType<typeof betterAuth>;
	const updateUser = auth.api.updateUser as (opts: {
		body: Record<string, unknown>;
		headers: Headers;
	}) => Promise<unknown>;
	try {
		await updateUser({ body, headers });
	} catch {
		await writeProfileLive(userId, body as ProfileFields);
	}
}

export const load: PageServerLoad = async ({ locals }) => {
	if (!locals.user) error(401, '로그인이 필요합니다.');
	if (locals.academyMembership?.role !== 'parent') {
		error(403, '학부모 계정만 이용할 수 있습니다.');
	}
	let phone = '';
	let smsConsent = false;
	if (!isMockAuthMode()) {
		const profile = await readProfileLive(locals.user.id);
		phone = profile.phone ?? '';
		smsConsent = profile.smsMarketingConsentAt != null;
	}
	return { phone, smsConsent, isMockAuth: isMockAuthMode() };
};

export const actions: Actions = {
	save: async ({ request, locals }) => {
		if (locals.academyMembership?.role !== 'parent') {
			return fail(403, { error: '학부모 계정만 저장할 수 있습니다.' });
		}
		const uid = locals.user?.id;
		if (!uid) return fail(401, { error: '로그인이 필요합니다.' });
		const fd = await request.formData();
		const phoneRaw = fd.get('phone')?.toString() ?? '';
		const agree = fd.get('smsMarketingConsent') === 'on';
		const phone = phoneRaw.trim() ? normalizeInvitePhone(phoneRaw) : null;
		if (phoneRaw.trim() && !phone) {
			return fail(400, { error: '휴대번호 형식이 올바르지 않습니다(010).' });
		}
		if (isMockAuthMode()) {
			return fail(400, { error: '목업 모드에서는 프로필을 저장할 수 없습니다.' });
		}
		try {
			await saveProfile(request.headers, uid, {
				phone: phone ?? null,
				smsMarketingConsentAt: agree ? new Date() : null
			});
		} catch (e) {
			console.error('[p/settings]', e);
			return fail(500, { error: '저장에 실패했습니다.' });
		}
		redirect(303, '/p/settings?saved=1');
	}
};
