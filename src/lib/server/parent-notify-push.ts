import type { Types } from 'mongoose';
import webpush from 'web-push';

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
	/** Web Push 실발송용 구독 키 — 없으면 스텁 경로로 처리한다. */
	p256dh?: string | null;
	auth?: string | null;
};

export type ParentNotifyPushResult =
	| { status: 'sent' }
	| { status: 'failed'; error: string }
	| { status: 'skipped'; reason: 'disabled' | 'unconfigured' | 'trial_blocked' };

export type ParentNotifyPushEnv = {
	PARENT_NOTIFY_PUSH_ENABLED?: string;
	PUSH_VAPID_PUBLIC_KEY?: string;
	PUSH_VAPID_PRIVATE_KEY?: string;
	PUSH_VAPID_SUBJECT?: string;
};

export type WebPushSubscriptionKeys = {
	endpoint: string;
	p256dh: string;
	auth: string;
};

export type WebPushSender = (subscription: WebPushSubscriptionKeys, body: string) => Promise<void>;

function envTrim(env: ParentNotifyPushEnv, key: keyof ParentNotifyPushEnv): string {
	return env[key]?.toString().trim() ?? '';
}

export function shouldSendParentNotifyPush(
	env: ParentNotifyPushEnv = process.env as ParentNotifyPushEnv
): boolean {
	return envTrim(env, 'PARENT_NOTIFY_PUSH_ENABLED') === 'true';
}

/** Web Push(VAPID) 실발송 가능 여부 — 키 쌍이 모두 있어야 한다. */
export function isWebPushVapidConfigured(
	env: ParentNotifyPushEnv = process.env as ParentNotifyPushEnv
): boolean {
	return (
		envTrim(env, 'PUSH_VAPID_PUBLIC_KEY').length > 0 &&
		envTrim(env, 'PUSH_VAPID_PRIVATE_KEY').length > 0
	);
}

export function buildPushBodyJson(payload: PaymentDuePushPayload): string {
	const dueStr = formatSeoulDateString(payload.dueDate);
	const desc = payload.description.trim() || '수강료';
	return JSON.stringify({
		title: `[${payload.academyName}] ${payload.studentName} 납부 안내`,
		body: `${desc} ${formatPaymentDueWon(payload.amountKrw)} · ${dueStr}`,
		url: '/p'
	});
}

async function defaultSendWebPush(
	subscription: WebPushSubscriptionKeys,
	body: string,
	env: ParentNotifyPushEnv
): Promise<void> {
	await webpush.sendNotification(
		{
			endpoint: subscription.endpoint,
			keys: { p256dh: subscription.p256dh, auth: subscription.auth }
		},
		body,
		{
			vapidDetails: {
				subject: envTrim(env, 'PUSH_VAPID_SUBJECT') || 'mailto:admin@academy-manage.local',
				publicKey: envTrim(env, 'PUSH_VAPID_PUBLIC_KEY'),
				privateKey: envTrim(env, 'PUSH_VAPID_PRIVATE_KEY')
			}
		}
	);
}

/**
 * 미납 안내 푸시. `PARENT_NOTIFY_PUSH_ENABLED=true` + VAPID 키 + 구독 키가 있으면
 * Web Push 실발송, 그 외에는 로그만 남기는 스텁 sent.
 */
export async function sendPaymentDuePush(
	payload: PaymentDuePushPayload,
	options?: {
		env?: ParentNotifyPushEnv;
		academyId?: Types.ObjectId;
		loadAcademyTrialGate?: LoadAcademyTrialGate;
		sendWebPush?: WebPushSender;
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
	const body = buildPushBodyJson(payload);
	if (
		isWebPushVapidConfigured(env) &&
		payload.p256dh &&
		payload.auth &&
		payload.endpoint.startsWith('https://')
	) {
		try {
			const send =
				options?.sendWebPush ??
				((sub: WebPushSubscriptionKeys, b: string) => defaultSendWebPush(sub, b, env));
			await send({ endpoint: payload.endpoint, p256dh: payload.p256dh, auth: payload.auth }, body);
			return { status: 'sent' };
		} catch (e) {
			const message = e instanceof Error ? e.message : String(e);
			return { status: 'failed', error: truncateInviteMailError(message) };
		}
	}
	void body;
	return { status: 'sent' };
}

export function parentNotifyPushNoticeMessage(notice: string | null): string | null {
	switch (notice) {
		case 'parent_notify_push_sent':
			return '납부 안내 푸시를 발송했습니다.';
		case 'parent_notify_push_skipped':
			return '푸시 발송이 비활성화되어 있습니다. PARENT_NOTIFY_PUSH_ENABLED=true 로 테스트하세요.';
		case 'parent_notify_push_trial_blocked':
			return '체험(trial) 학원에서는 외부 푸시를 보낼 수 없습니다.';
		case 'parent_notify_push_no_link':
			return '연결된 학부모 계정이 없습니다.';
		case 'parent_notify_push_no_consent':
			return '학부모가 푸시 알림 수신에 동의하지 않았습니다. `/p/settings`에서 동의를 받으세요.';
		case 'parent_notify_push_no_subscription':
			return '푸시 구독 정보가 없습니다. `/p/settings`에서 구독을 등록하세요.';
		case 'parent_notify_push_failed':
			return '푸시 발송에 실패했습니다.';
		default:
			return null;
	}
}
