import { Types } from 'mongoose';
import { describe, expect, it } from 'vitest';

import {
	isParentNotifyEmailSmtpReady,
	parentNotifyEmailNoticeMessage,
	sendPaymentDueEmail,
	shouldSendParentNotifyEmail
} from './parent-notify-email';

describe('parent-notify-email', () => {
	const payload = {
		to: 'parent@example.com',
		academyName: '테스트 학원',
		studentName: '김학생',
		amountKrw: 120_000,
		dueDate: new Date('2026-06-15T00:00:00+09:00'),
		description: '6월 수강료'
	};

	it('shouldSendParentNotifyEmail', () => {
		expect(shouldSendParentNotifyEmail({ PARENT_NOTIFY_EMAIL_ENABLED: 'true' })).toBe(true);
		expect(shouldSendParentNotifyEmail({})).toBe(false);
	});

	it('disabled면 skipped', async () => {
		const r = await sendPaymentDueEmail(payload, {
			env: { PARENT_NOTIFY_EMAIL_ENABLED: 'false' }
		});
		expect(r).toEqual({ status: 'skipped', reason: 'disabled' });
	});

	it('enabled·SMTP 없으면 stub sent', async () => {
		const r = await sendPaymentDueEmail(payload, {
			env: { PARENT_NOTIFY_EMAIL_ENABLED: 'true' }
		});
		expect(r).toEqual({ status: 'sent' });
		expect(isParentNotifyEmailSmtpReady({ PARENT_NOTIFY_EMAIL_ENABLED: 'true' })).toBe(false);
	});

	it('trial_blocked', async () => {
		const r = await sendPaymentDueEmail(payload, {
			env: { PARENT_NOTIFY_EMAIL_ENABLED: 'true' },
			academyId: new Types.ObjectId(),
			loadAcademyTrialGate: async () => ({
				status: 'trial',
				trialEndsAt: new Date('2099-01-01')
			})
		});
		expect(r).toEqual({ status: 'skipped', reason: 'trial_blocked' });
	});

	it('notice messages', () => {
		expect(parentNotifyEmailNoticeMessage('parent_notify_email_sent')).toContain('이메일');
	});
});
