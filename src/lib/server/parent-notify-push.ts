import type { Types } from 'mongoose';

import { formatSeoulDateString } from '$lib/server/date-seoul';
import { truncateInviteMailError } from '$lib/server/invite-mail';
import {
	formatPaymentDueWon,
	type PaymentDueNotifyPayload
} from '$lib/server/parent-notify-payload';
import { parentNotifyBlockedByTrial } from '$lib/server/parent-notify-trial';
import type { LoadAcademyTrialGate } from '$lib/server/invite-mail';

export type PaymentDuePushPayload = PaymentDueNotifyPayload & {
	endpoint: string;
};

export type ParentNotifyPushResult =
	| { status: 'sent' }
	| { status: 'failed'; error: string }
	| { status: 'skipped'; reason: 'disabled' | 'unconfigured' | 'trial_blocked' };

export type ParentNotifyPushEnv = {
	PARENT_NOTIFY_PUSH_ENABLED?: string;
};

function envTrim(env: ParentNotifyPushEnv, key: keyof ParentNotifyPushEnv): string {
	return env[key]?.toString().trim() ?? '';
}

export function shouldSendParentNotifyPush(
	env: ParentNotifyPushEnv = process.env as ParentNotifyPushEnv
): boolean {
	return envTrim(env, 'PARENT_NOTIFY_PUSH_ENABLED') === 'true';
}

function buildPushBody(payload: PaymentDuePushPayload): string {
	const dueStr = formatSeoulDateString(payload.dueDate);
	const desc = payload.description.trim() || '수강료';
	return [
		`[${payload.academyName}] ${payload.studentName} 납부 안내`,
		`${desc} ${formatPaymentDueWon(payload.amountKrw)} · ${dueStr}`
	].join('\n');
}

/**
 * 미납 안내 푸시 스텁. `PARENT_NOTIFY_PUSH_ENABLED=true` 이면 sent(로그만).
 */
export async function sendPaymentDuePush(
	payload: PaymentDuePushPayload,
	options?: {
		env?: ParentNotifyPushEnv;
		academyId?: Types.ObjectId;
		loadAcademyTrialGate?: LoadAcademyTrialGate;
	}
): Promise<ParentNotifyPushResult> {
	if (await parentNotifyBlockedByTrial(options?.academyId, options?.loadAcademyTrialGate)) {
		return { status: 'skipped', reason: 'trial_blocked' };
	}
	const env = options?.env ?? (process.env as ParentNotifyPushEnv);
	if (!shouldSendParentNotifyPush(env)) {
		const reason =
			envTrim(env, 'PARENT_NOTIFY_PUSH_ENABLED') !== 'true' ? 'disabled' : 'unconfigured';
		return { status: 'skipped', reason };
	}
	try {
		void buildPushBody(payload);
		return { status: 'sent' };
	} catch (e) {
		const message = e instanceof Error ? e.message : String(e);
		return { status: 'failed', error: truncateInviteMailError(message) };
	}
}

export function parentNotifyPushNoticeMessage(notice: string | null): string | null {
	switch (notice) {
		case 'parent_notify_push_sent':
			return '납부 안내 푸시를 발송했습니다(스텁).';
		case 'parent_notify_push_skipped':
			return '푸시 발송이 비활성화되어 있습니다. PARENT_NOTIFY_PUSH_ENABLED=true 로 테스트하세요.';
		case 'parent_notify_push_trial_blocked':
			return '체험(trial) 학원에서는 외부 푸시를 보낼 수 없습니다.';
		case 'parent_notify_push_no_link':
			return '연결된 학부모 계정이 없습니다.';
		case 'parent_notify_push_no_consent':
			return '학부모가 푸시 알림 수신에 동의하지 않았습니다. `/p/settings`에서 동의를 받으세요.';
		case 'parent_notify_push_no_subscription':
			return '푸시 구독 정보가 없습니다. `/p/settings`에서 구독 ID를 등록하세요(개발·스텁용).';
		case 'parent_notify_push_failed':
			return '푸시 발송에 실패했습니다.';
		default:
			return null;
	}
}
