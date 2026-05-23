import { describe, expect, it } from 'vitest';

import { buildInviteAcceptReturnPath, sanitizeInviteCallbackURL } from './invite-return';

describe('sanitizeInviteCallbackURL', () => {
	const origin = 'http://localhost:5173';

	it('유효한 invite accept 경로 허용', () => {
		expect(sanitizeInviteCallbackURL('/invite/accept?token=abc', origin)).toBe(
			'/invite/accept?token=abc'
		);
	});

	it('외부 origin 거부', () => {
		expect(sanitizeInviteCallbackURL('https://evil.com/invite/accept?token=x', origin)).toBe(
			'/invite/accept'
		);
	});

	it('invite 외 경로 거부', () => {
		expect(sanitizeInviteCallbackURL('/payments', origin)).toBe('/invite/accept');
	});

	it('invite/accept 접두사만 같은 다른 경로 거부', () => {
		expect(sanitizeInviteCallbackURL('/invite/accept-evil?token=x', origin)).toBe('/invite/accept');
	});
});

describe('buildInviteAcceptReturnPath', () => {
	it('token 인코딩', () => {
		expect(buildInviteAcceptReturnPath('a+b')).toContain('token=a%2Bb');
	});
});
