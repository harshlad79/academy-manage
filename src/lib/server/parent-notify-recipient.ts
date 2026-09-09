import type { Types } from 'mongoose';

import connectDB from '$lib/server/db';
import { ParentStudentLink } from '$lib/server/models/parent-student-link';
import { readUserProfileNotifyFields } from '$lib/server/user-profile-read';

export type PaymentNotifySmsRecipient = {
	to: string;
	parentUserId: string;
};

export type PaymentNotifyEmailRecipient = {
	to: string;
	parentUserId: string;
};

export type PaymentNotifyPushRecipient = {
	endpoint: string;
	p256dh: string | null;
	auth: string | null;
	parentUserId: string;
};

export type ResolveSmsResult =
	| { ok: true; recipients: PaymentNotifySmsRecipient[] }
	| { ok: false; reason: 'no_link' | 'no_consent' | 'no_phone' };

export type ResolveEmailResult =
	| { ok: true; recipients: PaymentNotifyEmailRecipient[] }
	| { ok: false; reason: 'no_link' | 'no_consent' | 'no_address' };

export type ResolvePushResult =
	| { ok: true; recipients: PaymentNotifyPushRecipient[] }
	| {
			ok: false;
			reason: 'no_link' | 'no_consent' | 'no_subscription';
	  };

/** @deprecated */
export type PaymentNotifyRecipient = PaymentNotifySmsRecipient;
/** @deprecated */
export type ResolvePaymentNotifyResult = ResolveSmsResult;

async function loadLinks(academyId: Types.ObjectId, studentId: Types.ObjectId) {
	await connectDB();
	return ParentStudentLink.find({ academyId, studentId }).lean();
}

export async function resolvePaymentNotifySmsRecipients(
	academyId: Types.ObjectId,
	studentId: Types.ObjectId
): Promise<ResolveSmsResult> {
	const links = await loadLinks(academyId, studentId);
	if (links.length === 0) return { ok: false, reason: 'no_link' };

	const recipients: PaymentNotifySmsRecipient[] = [];
	let sawLinkWithoutConsent = false;
	let sawLinkWithoutPhone = false;

	for (const link of links) {
		const profile = await readUserProfileNotifyFields(link.parentUserId);
		if (!profile.smsMarketingConsentAt) {
			sawLinkWithoutConsent = true;
			continue;
		}
		const phone = profile.phone?.trim();
		if (!phone) {
			sawLinkWithoutPhone = true;
			continue;
		}
		recipients.push({ to: phone, parentUserId: link.parentUserId });
	}

	if (recipients.length > 0) return { ok: true, recipients };
	if (sawLinkWithoutConsent) return { ok: false, reason: 'no_consent' };
	if (sawLinkWithoutPhone) return { ok: false, reason: 'no_phone' };
	return { ok: false, reason: 'no_link' };
}

export async function resolvePaymentNotifyEmailRecipients(
	academyId: Types.ObjectId,
	studentId: Types.ObjectId
): Promise<ResolveEmailResult> {
	const links = await loadLinks(academyId, studentId);
	if (links.length === 0) return { ok: false, reason: 'no_link' };

	const recipients: PaymentNotifyEmailRecipient[] = [];
	let sawLinkWithoutConsent = false;
	let sawLinkWithoutAddress = false;

	for (const link of links) {
		const profile = await readUserProfileNotifyFields(link.parentUserId);
		if (!profile.emailNotifyConsentAt) {
			sawLinkWithoutConsent = true;
			continue;
		}
		const email = profile.email?.trim();
		if (!email || !email.includes('@')) {
			sawLinkWithoutAddress = true;
			continue;
		}
		recipients.push({ to: email, parentUserId: link.parentUserId });
	}

	if (recipients.length > 0) return { ok: true, recipients };
	if (sawLinkWithoutConsent) return { ok: false, reason: 'no_consent' };
	if (sawLinkWithoutAddress) return { ok: false, reason: 'no_address' };
	return { ok: false, reason: 'no_link' };
}

export async function resolvePaymentNotifyPushRecipients(
	academyId: Types.ObjectId,
	studentId: Types.ObjectId
): Promise<ResolvePushResult> {
	const links = await loadLinks(academyId, studentId);
	if (links.length === 0) return { ok: false, reason: 'no_link' };

	const recipients: PaymentNotifyPushRecipient[] = [];
	let sawLinkWithoutConsent = false;
	let sawLinkWithoutSubscription = false;

	for (const link of links) {
		const profile = await readUserProfileNotifyFields(link.parentUserId);
		if (!profile.pushNotifyConsentAt) {
			sawLinkWithoutConsent = true;
			continue;
		}
		const sub = profile.pushSubscription?.endpoint
			? profile.pushSubscription
			: profile.pushSubscriptionEndpoint?.trim()
				? { endpoint: profile.pushSubscriptionEndpoint.trim(), p256dh: null, auth: null }
				: null;
		if (!sub || sub.endpoint.length < 8) {
			sawLinkWithoutSubscription = true;
			continue;
		}
		recipients.push({
			endpoint: sub.endpoint,
			p256dh: sub.p256dh,
			auth: sub.auth,
			parentUserId: link.parentUserId
		});
	}

	if (recipients.length > 0) return { ok: true, recipients };
	if (sawLinkWithoutConsent) return { ok: false, reason: 'no_consent' };
	if (sawLinkWithoutSubscription) return { ok: false, reason: 'no_subscription' };
	return { ok: false, reason: 'no_link' };
}

/** @deprecated Use resolvePaymentNotifySmsRecipients */
export async function resolvePaymentNotifyRecipients(
	academyId: Types.ObjectId,
	studentId: Types.ObjectId
): Promise<ResolveSmsResult> {
	return resolvePaymentNotifySmsRecipients(academyId, studentId);
}
