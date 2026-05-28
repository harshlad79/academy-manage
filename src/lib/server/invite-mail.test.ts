import { describe, expect, it, vi } from 'vitest';

import { Types } from 'mongoose';

import {
	buildInviteAcceptUrl,
	inviteBlockedByTrialGate,
	inviteMailNoticeMessage,
	inviteMailResultNotice,
	resolveInviteMailOrigin,
	sendAcademyInviteEmail,
	shouldSendInviteEmail,
	truncateInviteMailError
} from './invite-mail';

const baseEnv = {
	INVITE_MAIL_ENABLED: 'true',
	SMTP_HOST: 'smtp.naver.com',
	SMTP_PORT: '465',
	SMTP_SECURE: 'true',
	SMTP_USER: 'u@naver.com',
	SMTP_PASS: 'secret',
	INVITE_MAIL_FROM: 'u@naver.com',
	INVITE_MAIL_FROM_NAME: '학원'
};

describe('shouldSendInviteEmail', () => {
	it('ENABLED false 이면 false', () => {
		expect(shouldSendInviteEmail({ ...baseEnv, INVITE_MAIL_ENABLED: 'false' })).toBe(false);
	});

	it('SMTP 누락이면 false', () => {
		expect(shouldSendInviteEmail({ ...baseEnv, SMTP_PASS: '' })).toBe(false);
	});

	it('모두 설정되면 true', () => {
		expect(shouldSendInviteEmail(baseEnv)).toBe(true);
	});
});

describe('resolveInviteMailOrigin', () => {
	it('PUBLIC_APP_ORIGIN 우선', () => {
		expect(
			resolveInviteMailOrigin(
				{ PUBLIC_APP_ORIGIN: 'https://app.example/', BETTER_AUTH_URL: 'http://other' },
				'http://localhost:5173'
			)
		).toBe('https://app.example');
	});
});

describe('buildInviteAcceptUrl', () => {
	it('token 인코딩', () => {
		const url = buildInviteAcceptUrl('https://app.example', 'ab+c/d');
		expect(url).toContain('token=ab%2Bc%2Fd');
	});
});

describe('sendAcademyInviteEmail', () => {
	const payload = {
		to: 'invitee@example.com',
		academyName: '테스트 학원',
		role: 'teacher' as const,
		acceptUrl: 'https://app.example/invite/accept?token=abc',
		expiresAt: new Date('2026-06-01T00:00:00+09:00')
	};

	it('disabled 이면 skipped', async () => {
		const r = await sendAcademyInviteEmail(payload, {
			env: { ...baseEnv, INVITE_MAIL_ENABLED: 'false' }
		});
		expect(r).toEqual({ status: 'skipped', reason: 'disabled' });
	});

	it('trial academy 이면 trial_blocked (SMTP 호출 없음)', async () => {
		const sendMail = vi.fn().mockResolvedValue(undefined);
		const academyId = new Types.ObjectId();
		const r = await sendAcademyInviteEmail(payload, {
			env: baseEnv,
			sendMail,
			academyId,
			loadAcademyTrialGate: async () => ({
				status: 'trial',
				trialEndsAt: new Date('2099-01-01')
			})
		});
		expect(r).toEqual({ status: 'skipped', reason: 'trial_blocked' });
		expect(sendMail).not.toHaveBeenCalled();
	});

	it('성공 시 sent', async () => {
		const sendMail = vi.fn().mockResolvedValue(undefined);
		const r = await sendAcademyInviteEmail(payload, { env: baseEnv, sendMail });
		expect(r).toEqual({ status: 'sent' });
		expect(sendMail).toHaveBeenCalledWith(
			expect.objectContaining({
				to: 'invitee@example.com',
				subject: expect.stringContaining('테스트 학원')
			})
		);
		expect(sendMail.mock.calls[0][0].text).toContain('https://app.example/invite/accept');
	});

	it('실패 시 failed', async () => {
		const sendMail = vi.fn().mockRejectedValue(new Error('SMTP auth failed'));
		const r = await sendAcademyInviteEmail(payload, { env: baseEnv, sendMail });
		expect(r.status).toBe('failed');
		if (r.status === 'failed') {
			expect(r.error).toContain('SMTP auth failed');
		}
	});
});

describe('notice helpers', () => {
	it('inviteMailResultNotice', () => {
		expect(inviteMailResultNotice({ status: 'sent' }, 'create')).toBe('invite_mail_sent');
		expect(inviteMailResultNotice({ status: 'failed', error: 'x' }, 'resend')).toBe(
			'invite_resent_failed'
		);
		expect(inviteMailResultNotice({ status: 'skipped', reason: 'trial_blocked' }, 'create')).toBe(
			'invite_mail_trial_blocked'
		);
		expect(inviteMailResultNotice({ status: 'skipped', reason: 'trial_blocked' }, 'resend')).toBe(
			'invite_resent_trial_blocked'
		);
	});

	it('inviteMailNoticeMessage', () => {
		expect(inviteMailNoticeMessage('invite_mail_sent')).toContain('발송');
		expect(inviteMailNoticeMessage('invite_mail_trial_blocked')).toContain('체험');
		expect(inviteMailNoticeMessage(null)).toBe(null);
	});
});

describe('inviteBlockedByTrialGate', () => {
	it('trial status blocks', () => {
		expect(inviteBlockedByTrialGate({ status: 'trial', trialEndsAt: new Date('2099-01-01') })).toBe(
			true
		);
		expect(inviteBlockedByTrialGate({ status: 'active', trialEndsAt: null })).toBe(false);
		expect(inviteBlockedByTrialGate(null)).toBe(false);
	});
});

describe('truncateInviteMailError', () => {
	it('긴 메시지 자름', () => {
		expect(truncateInviteMailError('x'.repeat(600)).length).toBeLessThanOrEqual(500);
	});
});
