import type { Types } from 'mongoose';

import { formatSeoulDateString } from '$lib/server/date-seoul';
import {
	buildInviteAcceptUrl,
	resolveInviteMailOrigin,
	truncateInviteMailError,
	type InviteMailEnv
} from '$lib/server/invite-mail';
import { applyInviteSmsMeta } from '$lib/server/invite-sms-meta';

export type InviteSmsPayload = {
	to: string;
	academyName: string;
	acceptUrl: string;
	expiresAt: Date;
};

export type InviteSmsResult =
	| { status: 'sent' }
	| { status: 'failed'; error: string }
	| { status: 'skipped'; reason: 'disabled' | 'unconfigured' };

export type InviteSmsEnv = {
	INVITE_SMS_ENABLED?: string;
	INVITE_SMS_PROVIDER?: string;
};

function envTrim(env: InviteSmsEnv, key: keyof InviteSmsEnv): string {
	return env[key]?.toString().trim() ?? '';
}

export function shouldSendInviteSms(env: InviteSmsEnv = process.env as InviteSmsEnv): boolean {
	return envTrim(env, 'INVITE_SMS_ENABLED') === 'true';
}

function buildSmsBody(payload: InviteSmsPayload): string {
	const expiresStr = formatSeoulDateString(payload.expiresAt);
	return [
		`[${payload.academyName}] 학부모 포털 초대`,
		`만료: ${expiresStr}`,
		payload.acceptUrl
	].join('\n');
}

/**
 * 초대 SMS 발송 스텁. `INVITE_SMS_ENABLED=true` 이면 sent 로그만.
 * 실 업체 연동은 `INVITE_SMS_PROVIDER` 별 구현체 추가.
 */
export async function sendAcademyInviteSms(
	payload: InviteSmsPayload,
	options?: { env?: InviteSmsEnv }
): Promise<InviteSmsResult> {
	const env = options?.env ?? (process.env as InviteSmsEnv);
	if (!shouldSendInviteSms(env)) {
		const reason = envTrim(env, 'INVITE_SMS_ENABLED') !== 'true' ? 'disabled' : 'unconfigured';
		return { status: 'skipped', reason };
	}
	try {
		void buildSmsBody(payload);
		return { status: 'sent' };
	} catch (e) {
		const message = e instanceof Error ? e.message : String(e);
		return { status: 'failed', error: truncateInviteMailError(message) };
	}
}

export function inviteSmsNoticeMessage(notice: string | null): string | null {
	switch (notice) {
		case 'invite_sms_sent':
			return '초대를 생성했고 SMS를 발송했습니다.';
		case 'invite_sms_failed':
			return '초대는 생성됐으나 SMS 발송에 실패했습니다. 아래 링크를 복사하거나 재발송하세요.';
		case 'invite_sms_skipped':
			return '초대를 생성했습니다. (SMS 미발송 — INVITE_SMS_ENABLED 설정을 확인하세요.)';
		case 'invite_sms_resent_ok':
			return '초대 SMS를 다시 발송했습니다.';
		case 'invite_sms_resent_failed':
			return 'SMS 재발송에 실패했습니다. 오류 열과 수락 링크를 확인하세요.';
		default:
			return null;
	}
}

export function inviteSmsResultNotice(result: InviteSmsResult, kind: 'create' | 'resend'): string {
	if (result.status === 'sent') {
		return kind === 'create' ? 'invite_sms_sent' : 'invite_sms_resent_ok';
	}
	if (result.status === 'skipped') {
		return 'invite_sms_skipped';
	}
	return kind === 'create' ? 'invite_sms_failed' : 'invite_sms_resent_failed';
}

export async function dispatchInviteSms(
	inviteId: Types.ObjectId,
	academyName: string,
	phone: string,
	token: string,
	expiresAt: Date,
	requestOrigin: string,
	kind: 'create' | 'resend'
): Promise<string> {
	const mailEnv = process.env as InviteMailEnv & InviteSmsEnv;
	const originBase = resolveInviteMailOrigin(mailEnv, requestOrigin);
	const acceptUrl = buildInviteAcceptUrl(originBase, token);
	const smsResult = await sendAcademyInviteSms(
		{ to: phone, academyName, acceptUrl, expiresAt },
		{ env: mailEnv }
	);
	await applyInviteSmsMeta(inviteId, smsResult);
	return inviteSmsResultNotice(smsResult, kind);
}
