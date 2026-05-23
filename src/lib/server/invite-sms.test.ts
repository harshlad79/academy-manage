import { describe, expect, it } from 'vitest';

import {
	inviteSmsNoticeMessage,
	inviteSmsResultNotice,
	shouldSendInviteSms,
	sendAcademyInviteSms
} from './invite-sms';

describe('shouldSendInviteSms', () => {
	it('INVITE_SMS_ENABLED=true 일 때만', () => {
		expect(shouldSendInviteSms({ INVITE_SMS_ENABLED: 'true' })).toBe(true);
		expect(shouldSendInviteSms({ INVITE_SMS_ENABLED: 'false' })).toBe(false);
		expect(shouldSendInviteSms({})).toBe(false);
	});
});

describe('sendAcademyInviteSms', () => {
	const payload = {
		to: '01012345678',
		academyName: '테스트 학원',
		acceptUrl: 'https://app.example/invite/accept?token=abc',
		expiresAt: new Date('2026-06-01T00:00:00Z')
	};

	it('disabled면 skipped', async () => {
		const r = await sendAcademyInviteSms(payload, { env: { INVITE_SMS_ENABLED: 'false' } });
		expect(r).toEqual({ status: 'skipped', reason: 'disabled' });
	});

	it('enabled면 sent (stub)', async () => {
		const r = await sendAcademyInviteSms(payload, { env: { INVITE_SMS_ENABLED: 'true' } });
		expect(r).toEqual({ status: 'sent' });
	});
});

describe('inviteSmsResultNotice', () => {
	it('create/resend notice 키', () => {
		expect(inviteSmsResultNotice({ status: 'sent' }, 'create')).toBe('invite_sms_sent');
		expect(inviteSmsResultNotice({ status: 'skipped', reason: 'disabled' }, 'create')).toBe(
			'invite_sms_skipped'
		);
		expect(inviteSmsResultNotice({ status: 'failed', error: 'x' }, 'resend')).toBe(
			'invite_sms_resent_failed'
		);
	});
});

describe('inviteSmsNoticeMessage', () => {
	it('알려진 notice', () => {
		expect(inviteSmsNoticeMessage('invite_sms_sent')).toContain('SMS');
	});
});
