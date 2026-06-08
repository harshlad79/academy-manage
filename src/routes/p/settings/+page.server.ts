import { error, fail, redirect } from '@sveltejs/kit';
import { betterAuth } from 'better-auth';
import { env } from '$env/dynamic/private';
import { MongoClient } from 'mongodb';
import { getAuth, isMockAuthMode } from '$lib/server/auth';
import { normalizeInvitePhone } from '$lib/server/models/academy-invite';
import { readUserProfileNotifyFields } from '$lib/server/user-profile-read';
import type { Actions, PageServerLoad } from './$types';

type ProfileFields = {
	phone?: string | null;
	smsMarketingConsentAt?: Date | null;
	emailNotifyConsentAt?: Date | null;
	pushNotifyConsentAt?: Date | null;
	pushSubscriptionEndpoint?: string | null;
};

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
	let emailConsent = false;
	let pushConsent = false;
	let pushSubscriptionEndpoint = '';
	let accountEmail = locals.user.email ?? '';
	if (!isMockAuthMode()) {
		const profile = await readUserProfileNotifyFields(locals.user.id);
		phone = profile.phone ?? '';
		smsConsent = profile.smsMarketingConsentAt != null;
		emailConsent = profile.emailNotifyConsentAt != null;
		pushConsent = profile.pushNotifyConsentAt != null;
		pushSubscriptionEndpoint = profile.pushSubscriptionEndpoint ?? '';
		if (profile.email?.trim()) accountEmail = profile.email.trim();
	}
	return {
		phone,
		smsConsent,
		emailConsent,
		pushConsent,
		pushSubscriptionEndpoint,
		accountEmail,
		isMockAuth: isMockAuthMode()
	};
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
		const smsAgree = fd.get('smsMarketingConsent') === 'on';
		const emailAgree = fd.get('emailNotifyConsent') === 'on';
		const pushAgree = fd.get('pushNotifyConsent') === 'on';
		const pushSubRaw = fd.get('pushSubscriptionEndpoint')?.toString() ?? '';
		const pushSubTrim = pushSubRaw.trim();
		const phone = phoneRaw.trim() ? normalizeInvitePhone(phoneRaw) : null;
		if (phoneRaw.trim() && !phone) {
			return fail(400, { error: '휴대번호 형식이 올바르지 않습니다(010).' });
		}
		if (pushAgree && pushSubTrim.length > 0 && pushSubTrim.length < 8) {
			return fail(400, { error: '푸시 구독 ID는 8자 이상이어야 합니다(스텁·개발용).' });
		}
		if (isMockAuthMode()) {
			return fail(400, { error: '목업 모드에서는 프로필을 저장할 수 없습니다.' });
		}
		try {
			await saveProfile(request.headers, uid, {
				phone: phone ?? null,
				smsMarketingConsentAt: smsAgree ? new Date() : null,
				emailNotifyConsentAt: emailAgree ? new Date() : null,
				pushNotifyConsentAt: pushAgree ? new Date() : null,
				pushSubscriptionEndpoint: pushSubTrim.length > 0 ? pushSubTrim : null
			});
		} catch (e) {
			console.error('[p/settings]', e);
			return fail(500, { error: '저장에 실패했습니다.' });
		}
		redirect(303, '/p/settings?saved=1');
	}
};
