import type { Types } from 'mongoose';

import connectDB from '$lib/server/db';
import { Academy } from '$lib/server/models/academy';
import { InvoiceLine } from '$lib/server/models/invoice-line';
import { isPopulatedIdName } from '$lib/server/mongo-populate-guards';
import { isParentNotifyEmailSmtpReady } from '$lib/server/parent-notify-email';
import { sendPaymentDueEmail } from '$lib/server/parent-notify-email';
import { sendPaymentDuePush } from '$lib/server/parent-notify-push';
import {
	resolvePaymentNotifyEmailRecipients,
	resolvePaymentNotifyPushRecipients,
	resolvePaymentNotifySmsRecipients,
	type ResolveEmailResult,
	type ResolvePushResult,
	type ResolveSmsResult
} from '$lib/server/parent-notify-recipient';
import { sendPaymentDueSms } from '$lib/server/parent-notify-sms';

export type ParentPaymentNotifyOutcome = {
	notice: string;
	sentCount: number;
};

export type PaymentDueNotifyInput = {
	academyId: Types.ObjectId;
	academyName: string;
	studentId: Types.ObjectId;
	studentName: string;
	amountKrw: number;
	dueDate: Date;
	description: string;
};

function isOid(id: string): boolean {
	return /^[a-f\d]{24}$/i.test(id);
}

/** 미납 청구 1건 → 알림 입력. */
export async function loadPaymentDueNotifyInput(
	academyId: Types.ObjectId,
	invoiceLineIdRaw: string
): Promise<{ input: PaymentDueNotifyInput } | { error: string }> {
	const id = invoiceLineIdRaw.trim();
	if (!isOid(id)) return { error: '청구 ID가 올바르지 않습니다.' };

	await connectDB();
	const line = await InvoiceLine.findOne({ _id: id, academyId, status: 'open' })
		.populate({
			path: 'enrollmentId',
			populate: { path: 'studentId', select: 'name' }
		})
		.lean();
	if (!line) {
		const exists = await InvoiceLine.exists({ _id: id, academyId });
		if (!exists) return { error: '청구를 찾지 못했습니다.' };
		return { error: '미납 청구만 알림을 보낼 수 있습니다.' };
	}

	const enr = line.enrollmentId;
	const studentPop =
		enr &&
		typeof enr === 'object' &&
		'studentId' in enr &&
		isPopulatedIdName((enr as { studentId: unknown }).studentId)
			? (enr as { studentId: { _id: Types.ObjectId; name: string } }).studentId
			: null;
	if (!studentPop) return { error: '학생 정보를 찾을 수 없습니다.' };

	const academy = await Academy.findById(academyId).select('name').lean();
	return {
		input: {
			academyId,
			academyName: academy?.name?.trim() || '학원',
			studentId: studentPop._id,
			studentName: studentPop.name,
			amountKrw: line.amountKrw,
			dueDate: line.dueDate,
			description: line.description?.trim() || '수강료'
		}
	};
}

function smsNoticeFromResolveFailure(r: Extract<ResolveSmsResult, { ok: false }>): string {
	switch (r.reason) {
		case 'no_link':
			return 'parent_notify_no_link';
		case 'no_consent':
			return 'parent_notify_no_consent';
		case 'no_phone':
			return 'parent_notify_no_phone';
	}
}

function emailNoticeFromResolveFailure(r: Extract<ResolveEmailResult, { ok: false }>): string {
	switch (r.reason) {
		case 'no_link':
			return 'parent_notify_email_no_link';
		case 'no_consent':
			return 'parent_notify_email_no_consent';
		case 'no_address':
			return 'parent_notify_email_no_address';
	}
}

function pushNoticeFromResolveFailure(r: Extract<ResolvePushResult, { ok: false }>): string {
	switch (r.reason) {
		case 'no_link':
			return 'parent_notify_push_no_link';
		case 'no_consent':
			return 'parent_notify_push_no_consent';
		case 'no_subscription':
			return 'parent_notify_push_no_subscription';
	}
}

const payloadBase = (input: PaymentDueNotifyInput) => ({
	academyName: input.academyName,
	studentName: input.studentName,
	amountKrw: input.amountKrw,
	dueDate: input.dueDate,
	description: input.description
});

/** 미납 청구 1건 — SMS(스텁). */
export async function notifyParentsPaymentDueSms(
	input: PaymentDueNotifyInput
): Promise<ParentPaymentNotifyOutcome> {
	const resolved = await resolvePaymentNotifySmsRecipients(input.academyId, input.studentId);
	if (!resolved.ok) {
		return { notice: smsNoticeFromResolveFailure(resolved), sentCount: 0 };
	}

	let sentCount = 0;
	let lastNotice = 'parent_notify_skipped';

	for (const recipient of resolved.recipients) {
		const result = await sendPaymentDueSms(
			{ to: recipient.to, ...payloadBase(input) },
			{ academyId: input.academyId }
		);
		if (result.status === 'sent') {
			sentCount += 1;
			lastNotice = 'parent_notify_sent';
		} else if (result.status === 'skipped') {
			if (result.reason === 'trial_blocked') lastNotice = 'parent_notify_trial_blocked';
			else lastNotice = 'parent_notify_skipped';
		} else {
			lastNotice = 'parent_notify_failed';
		}
	}

	return { notice: lastNotice, sentCount };
}

/** @deprecated Use notifyParentsPaymentDueSms */
export async function notifyParentsPaymentDue(
	input: PaymentDueNotifyInput
): Promise<ParentPaymentNotifyOutcome> {
	return notifyParentsPaymentDueSms(input);
}

/** 미납 청구 1건 — 이메일(SMTP 또는 스텁). */
export async function notifyParentsPaymentDueEmail(
	input: PaymentDueNotifyInput
): Promise<ParentPaymentNotifyOutcome> {
	const resolved = await resolvePaymentNotifyEmailRecipients(input.academyId, input.studentId);
	if (!resolved.ok) {
		return { notice: emailNoticeFromResolveFailure(resolved), sentCount: 0 };
	}

	const smtpReady = isParentNotifyEmailSmtpReady();
	let sentCount = 0;
	let lastNotice = 'parent_notify_email_skipped';

	for (const recipient of resolved.recipients) {
		const result = await sendPaymentDueEmail(
			{ to: recipient.to, ...payloadBase(input) },
			{ academyId: input.academyId }
		);
		if (result.status === 'sent') {
			sentCount += 1;
			lastNotice = smtpReady ? 'parent_notify_email_sent' : 'parent_notify_email_stub';
		} else if (result.status === 'skipped') {
			if (result.reason === 'trial_blocked') lastNotice = 'parent_notify_email_trial_blocked';
			else lastNotice = 'parent_notify_email_skipped';
		} else {
			lastNotice = 'parent_notify_email_failed';
		}
	}

	return { notice: lastNotice, sentCount };
}

/** 미납 청구 1건 — 푸시(스텁). */
export async function notifyParentsPaymentDuePush(
	input: PaymentDueNotifyInput
): Promise<ParentPaymentNotifyOutcome> {
	const resolved = await resolvePaymentNotifyPushRecipients(input.academyId, input.studentId);
	if (!resolved.ok) {
		return { notice: pushNoticeFromResolveFailure(resolved), sentCount: 0 };
	}

	let sentCount = 0;
	let lastNotice = 'parent_notify_push_skipped';

	for (const recipient of resolved.recipients) {
		const result = await sendPaymentDuePush(
			{
				endpoint: recipient.endpoint,
				p256dh: recipient.p256dh,
				auth: recipient.auth,
				...payloadBase(input)
			},
			{ academyId: input.academyId }
		);
		if (result.status === 'sent') {
			sentCount += 1;
			lastNotice = 'parent_notify_push_sent';
		} else if (result.status === 'skipped') {
			if (result.reason === 'trial_blocked') lastNotice = 'parent_notify_push_trial_blocked';
			else lastNotice = 'parent_notify_push_skipped';
		} else {
			lastNotice = 'parent_notify_push_failed';
		}
	}

	return { notice: lastNotice, sentCount };
}
