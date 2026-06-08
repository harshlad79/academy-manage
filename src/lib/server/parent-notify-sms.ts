import type { Types } from 'mongoose';

import { formatSeoulDateString } from '$lib/server/date-seoul';
import { truncateInviteMailError } from '$lib/server/invite-mail';
import type { LoadAcademyTrialGate } from '$lib/server/invite-mail';
import {
	formatPaymentDueWon,
	type PaymentDueNotifyPayload
} from '$lib/server/parent-notify-payload';
import { parentNotifyBlockedByTrial } from '$lib/server/parent-notify-trial';

export type PaymentDueSmsPayload = PaymentDueNotifyPayload & {
	to: string;
};

export type ParentNotifySmsResult =
	| { status: 'sent' }
	| { status: 'failed'; error: string }
	| { status: 'skipped'; reason: 'disabled' | 'unconfigured' | 'trial_blocked' };

export type ParentNotifySmsEnv = {
	PARENT_NOTIFY_SMS_ENABLED?: string;
};

function envTrim(env: ParentNotifySmsEnv, key: keyof ParentNotifySmsEnv): string {
	return env[key]?.toString().trim() ?? '';
}

export function shouldSendParentNotifySms(
	env: ParentNotifySmsEnv = process.env as ParentNotifySmsEnv
): boolean {
	return envTrim(env, 'PARENT_NOTIFY_SMS_ENABLED') === 'true';
}

function buildPaymentDueSmsBody(payload: PaymentDueSmsPayload): string {
	const dueStr = formatSeoulDateString(payload.dueDate);
	const desc = payload.description.trim() || '수강료';
	return [
		`[${payload.academyName}] ${payload.studentName} 납부 안내`,
		`${desc} ${formatPaymentDueWon(payload.amountKrw)} · 납부기한 ${dueStr}`
	].join('\n');
}

/**
 * 미납 안내 SMS 스텁. `PARENT_NOTIFY_SMS_ENABLED=true` 이면 sent 로그만.
 */
export async function sendPaymentDueSms(
	payload: PaymentDueSmsPayload,
	options?: {
		env?: ParentNotifySmsEnv;
		academyId?: Types.ObjectId;
		loadAcademyTrialGate?: LoadAcademyTrialGate;
	}
): Promise<ParentNotifySmsResult> {
	if (await parentNotifyBlockedByTrial(options?.academyId, options?.loadAcademyTrialGate)) {
		return { status: 'skipped', reason: 'trial_blocked' };
	}
	const env = options?.env ?? (process.env as ParentNotifySmsEnv);
	if (!shouldSendParentNotifySms(env)) {
		const reason =
			envTrim(env, 'PARENT_NOTIFY_SMS_ENABLED') !== 'true' ? 'disabled' : 'unconfigured';
		return { status: 'skipped', reason };
	}
	try {
		void buildPaymentDueSmsBody(payload);
		return { status: 'sent' };
	} catch (e) {
		const message = e instanceof Error ? e.message : String(e);
		return { status: 'failed', error: truncateInviteMailError(message) };
	}
}

export function parentNotifySmsNoticeMessage(notice: string | null): string | null {
	switch (notice) {
		case 'parent_notify_sent':
			return '납부 안내 SMS를 발송했습니다(스텁).';
		case 'parent_notify_skipped':
			return 'SMS 발송이 비활성화되어 있습니다. `.env`에서 PARENT_NOTIFY_SMS_ENABLED=true 로 테스트하세요.';
		case 'parent_notify_trial_blocked':
			return '체험(trial) 학원에서는 외부 SMS를 보낼 수 없습니다.';
		case 'parent_notify_no_link':
			return '연결된 학부모 계정이 없습니다. 학생·학부모 연결 후 다시 시도하세요.';
		case 'parent_notify_no_consent':
			return '학부모가 SMS 수신에 동의하지 않았습니다. `/p/settings`에서 동의를 받으세요.';
		case 'parent_notify_no_phone':
			return '학부모 계정에 휴대번호가 없습니다. `/p/settings`에서 번호를 등록하세요.';
		case 'parent_notify_failed':
			return 'SMS 발송에 실패했습니다. 잠시 후 다시 시도하세요.';
		default:
			return null;
	}
}
