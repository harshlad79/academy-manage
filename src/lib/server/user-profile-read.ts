import { MongoClient } from 'mongodb';
import { env } from '$env/dynamic/private';

export type UserProfilePushSubscription = {
	endpoint: string;
	p256dh: string | null;
	auth: string | null;
};

export type UserProfileNotifyFields = {
	phone: string | null;
	smsMarketingConsentAt: Date | null;
	email: string | null;
	emailNotifyConsentAt: Date | null;
	pushNotifyConsentAt: Date | null;
	pushSubscriptionEndpoint: string | null;
	pushSubscription: UserProfilePushSubscription | null;
};

/** @deprecated Use readUserProfileNotifyFields */
export type UserProfileSmsFields = Pick<UserProfileNotifyFields, 'phone' | 'smsMarketingConsentAt'>;

function parsePushSubscription(raw: unknown): UserProfilePushSubscription | null {
	if (!raw || typeof raw !== 'object') return null;
	const rec = raw as Record<string, unknown>;
	const endpoint = typeof rec.endpoint === 'string' ? rec.endpoint : null;
	if (!endpoint) return null;
	const keys =
		rec.keys && typeof rec.keys === 'object' ? (rec.keys as Record<string, unknown>) : {};
	return {
		endpoint,
		p256dh: typeof keys.p256dh === 'string' ? keys.p256dh : null,
		auth: typeof keys.auth === 'string' ? keys.auth : null
	};
}

function parseProfileDoc(doc: Record<string, unknown> | null): UserProfileNotifyFields {
	return {
		phone: typeof doc?.phone === 'string' ? doc.phone : null,
		smsMarketingConsentAt:
			doc?.smsMarketingConsentAt instanceof Date ? doc.smsMarketingConsentAt : null,
		email: typeof doc?.email === 'string' ? doc.email : null,
		emailNotifyConsentAt:
			doc?.emailNotifyConsentAt instanceof Date ? doc.emailNotifyConsentAt : null,
		pushNotifyConsentAt: doc?.pushNotifyConsentAt instanceof Date ? doc.pushNotifyConsentAt : null,
		pushSubscriptionEndpoint:
			typeof doc?.pushSubscriptionEndpoint === 'string' ? doc.pushSubscriptionEndpoint : null,
		pushSubscription: parsePushSubscription(doc?.pushSubscription)
	};
}

/** Better Auth `user` 컬렉션에서 알림·연락 프로필을 읽는다. */
export async function readUserProfileNotifyFields(
	userId: string
): Promise<UserProfileNotifyFields> {
	const url = env.DB_URL?.trim();
	if (!url) {
		return {
			phone: null,
			smsMarketingConsentAt: null,
			email: null,
			emailNotifyConsentAt: null,
			pushNotifyConsentAt: null,
			pushSubscriptionEndpoint: null,
			pushSubscription: null
		};
	}
	const client = new MongoClient(url);
	try {
		const doc = await client
			.db('academy-db')
			.collection('user')
			.findOne(
				{ $or: [{ id: userId }, { userId }] },
				{
					projection: {
						phone: 1,
						smsMarketingConsentAt: 1,
						email: 1,
						emailNotifyConsentAt: 1,
						pushNotifyConsentAt: 1,
						pushSubscriptionEndpoint: 1,
						pushSubscription: 1
					}
				}
			);
		return parseProfileDoc(doc as Record<string, unknown> | null);
	} finally {
		await client.close();
	}
}

/** SMS 전용 — 하위 호환 */
export async function readUserProfileSmsFields(userId: string): Promise<UserProfileSmsFields> {
	const p = await readUserProfileNotifyFields(userId);
	return { phone: p.phone, smsMarketingConsentAt: p.smsMarketingConsentAt };
}
