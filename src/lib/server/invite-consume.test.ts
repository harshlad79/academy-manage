import { describe, expect, it } from 'vitest';

import { consumeInviteFailureMessage, type ConsumeInviteResult } from './invite-consume';

function err(
	code: Extract<ConsumeInviteResult, { ok: false }>['code'],
	message?: string
): Extract<ConsumeInviteResult, { ok: false }> {
	return message !== undefined ? { ok: false, code, message } : { ok: false, code };
}

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
