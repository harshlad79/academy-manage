import { Types } from 'mongoose';
import { describe, expect, it } from 'vitest';

import {
	parentNotifySmsNoticeMessage,
	sendPaymentDueSms,
	shouldSendParentNotifySms
} from './parent-notify-sms';

describe('shouldSendParentNotifySms', () => {
	it('PARENT_NOTIFY_SMS_ENABLED=true 일 때만', () => {
		expect(shouldSendParentNotifySms({ PARENT_NOTIFY_SMS_ENABLED: 'true' })).toBe(true);
		expect(shouldSendParentNotifySms({ PARENT_NOTIFY_SMS_ENABLED: 'false' })).toBe(false);
		expect(shouldSendParentNotifySms({})).toBe(false);
	});
});

describe('sendPaymentDueSms', () => {
	const payload = {
		to: '01012345678',
		academyName: '테스트 학원',
		studentName: '김학생',
		amountKrw: 120_000,
		dueDate: new Date('2026-06-15T00:00:00+09:00'),
		description: '6월 수강료'
	};

	it('disabled면 skipped', async () => {
		const r = await sendPaymentDueSms(payload, { env: { PARENT_NOTIFY_SMS_ENABLED: 'false' } });
		expect(r).toEqual({ status: 'skipped', reason: 'disabled' });
	});

	it('enabled면 sent (stub)', async () => {
		const r = await sendPaymentDueSms(payload, { env: { PARENT_NOTIFY_SMS_ENABLED: 'true' } });
		expect(r).toEqual({ status: 'sent' });
	});

	it('trial academy 이면 trial_blocked', async () => {
		const r = await sendPaymentDueSms(payload, {
			env: { PARENT_NOTIFY_SMS_ENABLED: 'true' },
			academyId: new Types.ObjectId(),
			loadAcademyTrialGate: async () => ({
				status: 'trial',
				trialEndsAt: new Date('2099-01-01')
			})
		});
		expect(r).toEqual({ status: 'skipped', reason: 'trial_blocked' });
	});
});

describe('parentNotifySmsNoticeMessage', () => {
	it('maps known notices', () => {
		expect(parentNotifySmsNoticeMessage('parent_notify_sent')).toContain('발송');
		expect(parentNotifySmsNoticeMessage('parent_notify_no_consent')).toContain('동의');
	});
});
