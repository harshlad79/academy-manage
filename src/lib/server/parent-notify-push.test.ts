import { Types } from 'mongoose';
import { describe, expect, it } from 'vitest';

import {
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

	it('shouldSendParentNotifyPush', () => {
		expect(shouldSendParentNotifyPush({ PARENT_NOTIFY_PUSH_ENABLED: 'true' })).toBe(true);
		expect(shouldSendParentNotifyPush({})).toBe(false);
	});

	it('enabled면 stub sent', async () => {
		const r = await sendPaymentDuePush(payload, {
			env: { PARENT_NOTIFY_PUSH_ENABLED: 'true' }
		});
		expect(r).toEqual({ status: 'sent' });
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
