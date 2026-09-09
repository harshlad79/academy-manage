import { Types } from 'mongoose';
import { describe, expect, it, vi } from 'vitest';

import {
	buildPushBodyJson,
	isWebPushVapidConfigured,
	parentNotifyPushNoticeMessage,
	sendPaymentDuePush,
	shouldSendParentNotifyPush
} from './parent-notify-push';

describe('parent-notify-push', () => {
	const payload = {
		endpoint: 'https://push.stub/endpoint-1',
		academyName: '테스트 학원',
		studentName: '김학생',
		amountKrw: 120_000,
		dueDate: new Date('2026-06-15T00:00:00+09:00'),
		description: '6월 수강료'
	};
	const vapidEnv = {
		PARENT_NOTIFY_PUSH_ENABLED: 'true',
		PUSH_VAPID_PUBLIC_KEY: 'BPubKey',
		PUSH_VAPID_PRIVATE_KEY: 'PrivKey'
	};

	it('shouldSendParentNotifyPush', () => {
		expect(shouldSendParentNotifyPush({ PARENT_NOTIFY_PUSH_ENABLED: 'true' })).toBe(true);
		expect(shouldSendParentNotifyPush({})).toBe(false);
	});

	it('isWebPushVapidConfigured requires both keys', () => {
		expect(isWebPushVapidConfigured(vapidEnv)).toBe(true);
		expect(isWebPushVapidConfigured({ PARENT_NOTIFY_PUSH_ENABLED: 'true' })).toBe(false);
		expect(
			isWebPushVapidConfigured({
				PARENT_NOTIFY_PUSH_ENABLED: 'true',
				PUSH_VAPID_PUBLIC_KEY: 'BPubKey'
			})
		).toBe(false);
	});

	it('enabled면 stub sent', async () => {
		const r = await sendPaymentDuePush(payload, {
			env: { PARENT_NOTIFY_PUSH_ENABLED: 'true' }
		});
		expect(r).toEqual({ status: 'sent' });
	});

	it('VAPID+구독 키가 있으면 Web Push 실발송', async () => {
		const sendWebPush = vi.fn().mockResolvedValue(undefined);
		const r = await sendPaymentDuePush(
			{ ...payload, p256dh: 'k-p256dh', auth: 'k-auth' },
			{ env: vapidEnv, sendWebPush }
		);
		expect(r).toEqual({ status: 'sent' });
		expect(sendWebPush).toHaveBeenCalledTimes(1);
		expect(sendWebPush.mock.calls[0][0]).toEqual({
			endpoint: 'https://push.stub/endpoint-1',
			p256dh: 'k-p256dh',
			auth: 'k-auth'
		});
		const body = JSON.parse(sendWebPush.mock.calls[0][1]);
		expect(body.title).toContain('테스트 학원');
		expect(body.url).toBe('/p');
	});

	it('VAPID 있어도 구독 키가 없으면 스텁(실발송 안 함)', async () => {
		const sendWebPush = vi.fn().mockResolvedValue(undefined);
		const r = await sendPaymentDuePush(payload, { env: vapidEnv, sendWebPush });
		expect(r).toEqual({ status: 'sent' });
		expect(sendWebPush).not.toHaveBeenCalled();
	});

	it('실발송 실패 시 failed', async () => {
		const sendWebPush = vi.fn().mockRejectedValue(new Error('410 Gone'));
		const r = await sendPaymentDuePush(
			{ ...payload, p256dh: 'k-p256dh', auth: 'k-auth' },
			{ env: vapidEnv, sendWebPush }
		);
		expect(r).toEqual({ status: 'failed', error: '410 Gone' });
	});

	it('buildPushBodyJson', () => {
		const body = JSON.parse(buildPushBodyJson(payload));
		expect(body.body).toContain('120,000');
	});

	it('trial_blocked', async () => {
		const r = await sendPaymentDuePush(payload, {
			env: { PARENT_NOTIFY_PUSH_ENABLED: 'true' },
			academyId: new Types.ObjectId(),
			loadAcademyTrialGate: async () => ({
				status: 'trial',
				trialEndsAt: new Date('2099-01-01')
			})
		});
		expect(r).toEqual({ status: 'skipped', reason: 'trial_blocked' });
	});

	it('notice messages', () => {
		expect(parentNotifyPushNoticeMessage('parent_notify_push_sent')).toContain('푸시');
	});
});
