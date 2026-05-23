import { describe, expect, it } from 'vitest';

import {
	consumeInviteFailureMessage,
	invitePhoneLast4,
	resolveInviteAcceptUi,
	type ConsumeInviteResult
} from './invite-consume';

function err(
	code: Extract<ConsumeInviteResult, { ok: false }>['code'],
	message?: string
): Extract<ConsumeInviteResult, { ok: false }> {
	return message !== undefined ? { ok: false, code, message } : { ok: false, code };
}

describe('resolveInviteAcceptUi', () => {
	it('parent는 로그인만 있으면 can_accept', () => {
		expect(resolveInviteAcceptUi({ email: null }, { role: 'parent' })).toBe('can_accept');
		expect(resolveInviteAcceptUi(null, { role: 'parent' })).toBe('need_login');
	});

	it('teacher는 email 일치 필요', () => {
		expect(resolveInviteAcceptUi({ email: 'a@b.co' }, { role: 'teacher', email: 'a@b.co' })).toBe(
			'can_accept'
		);
		expect(resolveInviteAcceptUi({ email: 'x@b.co' }, { role: 'teacher', email: 'a@b.co' })).toBe(
			'email_mismatch'
		);
	});
});

describe('invitePhoneLast4', () => {
	it('끝 4자리', () => {
		expect(invitePhoneLast4('01012345678')).toBe('5678');
		expect(invitePhoneLast4('')).toBe(null);
	});
});

describe('consumeInviteFailureMessage', () => {
	it('코드별 한국어 메시지', () => {
		expect(consumeInviteFailureMessage(err('missing_token'))).toContain('토큰');
		expect(consumeInviteFailureMessage(err('no_session_email'))).toContain('이메일');
		expect(consumeInviteFailureMessage(err('invalid'))).toContain('유효하지');
		expect(consumeInviteFailureMessage(err('expired'))).toContain('만료');
		expect(consumeInviteFailureMessage(err('email_mismatch'))).toContain('일치');
		expect(consumeInviteFailureMessage(err('dup_membership'))).toContain('멤버십');
		expect(consumeInviteFailureMessage(err('teacher_link', '커스텀'))).toBe('커스텀');
		expect(consumeInviteFailureMessage(err('live_user_missing'))).toContain('Better Auth');
	});
});
