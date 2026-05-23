import { fail, redirect } from '@sveltejs/kit';
import { betterAuth } from 'better-auth';
import { env } from '$env/dynamic/private';
import { MongoClient } from 'mongodb';
import { getAuth, isMockAuthMode } from '$lib/server/auth';
import { needsTermsAcceptance } from '$lib/server/terms-gate';
import type { Actions, PageServerLoad } from './$types';

function safeNext(raw: string | null): string {
	const n = raw?.trim() || '/';
	if (!n.startsWith('/') || n.startsWith('//')) return '/';
	return n;
}

async function setTermsAcceptedAtLive(userId: string, acceptedAt: Date): Promise<void> {
	const url = env.DB_URL?.trim();
	if (!url) throw new Error('DB_URL required');
	const client = new MongoClient(url);
	try {
		const result = await client
			.db('academy-db')
			.collection('user')
			.updateOne(
				{ $or: [{ id: userId }, { userId }] },
				{ $set: { termsAcceptedAt: acceptedAt, updatedAt: acceptedAt } }
			);
		if (result.matchedCount === 0) throw new Error('user not found');
	} finally {
		await client.close();
	}
}

async function acceptTerms(headers: Headers, userId: string): Promise<void> {
	const now = new Date();
	const auth = getAuth() as ReturnType<typeof betterAuth>;
	const updateUser = auth.api.updateUser as (opts: {
		body: Record<string, unknown>;
		headers: Headers;
	}) => Promise<unknown>;
	try {
		await updateUser({
			body: { termsAcceptedAt: now },
			headers
		});
	} catch {
		await setTermsAcceptedAtLive(userId, now);
	}
}

export const load: PageServerLoad = async ({ locals, url }) => {
	if (isMockAuthMode()) redirect(303, '/');
	if (!locals.user) {
		redirect(
			303,
			`/auth/sign-in?callbackURL=${encodeURIComponent(safeNext(url.searchParams.get('next')))}`
		);
	}
	if (!needsTermsAcceptance(locals.user as { termsAcceptedAt?: Date | null })) {
		redirect(303, safeNext(url.searchParams.get('next')));
	}
	return { next: safeNext(url.searchParams.get('next')) };
};

export const actions: Actions = {
	accept: async ({ locals, url, request }) => {
		if (isMockAuthMode()) redirect(303, '/');
		const uid = locals.user?.id;
		if (!uid) return fail(401, { error: '로그인이 필요합니다.' });
		try {
			await acceptTerms(request.headers, uid);
		} catch (e) {
			console.error('[accept-terms]', e);
			return fail(500, { error: '약관 동의 저장에 실패했습니다.' });
		}
		redirect(303, safeNext(url.searchParams.get('next')));
	}
};
