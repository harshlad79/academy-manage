import type { Types } from 'mongoose';
import nodemailer from 'nodemailer';
import type { Transporter } from 'nodemailer';

import { formatSeoulDateString } from '$lib/server/date-seoul';
import {
	truncateInviteMailError,
	type InviteMailEnv,
	type InviteMailSendFn
} from '$lib/server/invite-mail';
import {
	formatPaymentDueWon,
	type PaymentDueNotifyPayload
} from '$lib/server/parent-notify-payload';
import { parentNotifyBlockedByTrial } from '$lib/server/parent-notify-trial';
import type { LoadAcademyTrialGate } from '$lib/server/invite-mail';

export type PaymentDueEmailPayload = PaymentDueNotifyPayload & {
	to: string;
};

export type ParentNotifyEmailResult =
	| { status: 'sent' }
	| { status: 'failed'; error: string }
	| { status: 'skipped'; reason: 'disabled' | 'unconfigured' | 'trial_blocked' };

export type ParentNotifyEmailEnv = InviteMailEnv & {
	PARENT_NOTIFY_EMAIL_ENABLED?: string;
};

function envTrim(env: ParentNotifyEmailEnv, key: keyof ParentNotifyEmailEnv): string {
	return env[key]?.toString().trim() ?? '';
}

export function shouldSendParentNotifyEmail(
	env: ParentNotifyEmailEnv = process.env as ParentNotifyEmailEnv
): boolean {
	return envTrim(env, 'PARENT_NOTIFY_EMAIL_ENABLED') === 'true';
}

export function isParentNotifyEmailSmtpReady(
	env: ParentNotifyEmailEnv = process.env as ParentNotifyEmailEnv
): boolean {
	return (
		envTrim(env, 'SMTP_USER').length > 0 &&
		envTrim(env, 'SMTP_PASS').length > 0 &&
		envTrim(env, 'INVITE_MAIL_FROM').length > 0
	);
}

function escapeHtml(s: string): string {
	return s
		.replace(/&/g, '&amp;')
		.replace(/</g, '&lt;')
		.replace(/>/g, '&gt;')
		.replace(/"/g, '&quot;');
}

function buildMailContent(payload: PaymentDueEmailPayload, fromName: string, fromAddress: string) {
	const dueStr = formatSeoulDateString(payload.dueDate);
	const desc = payload.description.trim() || '수강료';
	const amountStr = formatPaymentDueWon(payload.amountKrw);
	const subject = `[${payload.academyName}] ${payload.studentName} 납부 안내`;
	const text = [
		`${payload.academyName}에서 ${payload.studentName} 학생의 납부 안내입니다.`,
		'',
		`${desc}: ${amountStr}`,
		`납부 기한: ${dueStr}`,
		'',
		'학부모 포털에서 미납 내역을 확인해 주세요.'
	].join('\n');
	const html = [
		`<p><strong>${escapeHtml(payload.academyName)}</strong>에서 <strong>${escapeHtml(payload.studentName)}</strong> 학생의 납부 안내입니다.</p>`,
		`<p>${escapeHtml(desc)}: <strong>${escapeHtml(amountStr)}</strong><br/>`,
		`납부 기한: ${escapeHtml(dueStr)}</p>`,
		`<p>학부모 포털에서 미납 내역을 확인해 주세요.</p>`
	].join('');
	return {
		from: fromName ? `"${fromName}" <${fromAddress}>` : fromAddress,
		to: payload.to,
		subject,
		text,
		html
	};
}

function createTransportFromEnv(env: ParentNotifyEmailEnv): Transporter {
	const host = envTrim(env, 'SMTP_HOST') || 'smtp.naver.com';
	const port = Number(envTrim(env, 'SMTP_PORT') || '465');
	const secure = envTrim(env, 'SMTP_SECURE') === 'false' ? false : port === 465 || port === 587;
	return nodemailer.createTransport({
		host,
		port,
		secure,
		auth: {
			user: envTrim(env, 'SMTP_USER'),
			pass: envTrim(env, 'SMTP_PASS')
		}
	});
}

/**
 * 미납 안내 이메일. `PARENT_NOTIFY_EMAIL_ENABLED=true` 이면 SMTP 설정 시 실발송, 없으면 스텁 sent.
 */
export async function sendPaymentDueEmail(
	payload: PaymentDueEmailPayload,
	options?: {
		env?: ParentNotifyEmailEnv;
		sendMail?: InviteMailSendFn;
		academyId?: Types.ObjectId;
		loadAcademyTrialGate?: LoadAcademyTrialGate;
	}
): Promise<ParentNotifyEmailResult> {
	if (await parentNotifyBlockedByTrial(options?.academyId, options?.loadAcademyTrialGate)) {
		return { status: 'skipped', reason: 'trial_blocked' };
	}
	const env = options?.env ?? (process.env as ParentNotifyEmailEnv);
	if (!shouldSendParentNotifyEmail(env)) {
		const reason =
			envTrim(env, 'PARENT_NOTIFY_EMAIL_ENABLED') !== 'true' ? 'disabled' : 'unconfigured';
		return { status: 'skipped', reason };
	}

	const smtpReady = isParentNotifyEmailSmtpReady(env);
	if (!smtpReady) {
		void buildMailContent(payload, '학원 관리', 'noreply@stub.local');
		return { status: 'sent' };
	}

	const fromAddress = envTrim(env, 'INVITE_MAIL_FROM');
	const fromName = envTrim(env, 'INVITE_MAIL_FROM_NAME') || '학원 관리';
	const content = buildMailContent(payload, fromName, fromAddress);
	try {
		if (options?.sendMail) {
			await options.sendMail(content);
		} else {
			const transport = createTransportFromEnv(env);
			await transport.sendMail(content);
		}
		return { status: 'sent' };
	} catch (e) {
		const message = e instanceof Error ? e.message : String(e);
		return { status: 'failed', error: truncateInviteMailError(message) };
	}
}

export function parentNotifyEmailNoticeMessage(notice: string | null): string | null {
	switch (notice) {
		case 'parent_notify_email_sent':
			return '납부 안내 이메일을 발송했습니다.';
		case 'parent_notify_email_stub':
			return '납부 안내 이메일을 발송했습니다(스텁 — SMTP 미설정).';
		case 'parent_notify_email_skipped':
			return '이메일 발송이 비활성화되어 있습니다. PARENT_NOTIFY_EMAIL_ENABLED=true 로 테스트하세요.';
		case 'parent_notify_email_trial_blocked':
			return '체험(trial) 학원에서는 외부 이메일을 보낼 수 없습니다.';
		case 'parent_notify_email_no_link':
			return '연결된 학부모 계정이 없습니다.';
		case 'parent_notify_email_no_consent':
			return '학부모가 이메일 알림 수신에 동의하지 않았습니다. `/p/settings`에서 동의를 받으세요.';
		case 'parent_notify_email_no_address':
			return '학부모 계정에 이메일 주소가 없습니다.';
		case 'parent_notify_email_failed':
			return '이메일 발송에 실패했습니다.';
		default:
			return null;
	}
}
