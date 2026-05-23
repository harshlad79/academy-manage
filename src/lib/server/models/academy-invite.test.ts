import { describe, expect, it } from 'vitest';

import { normalizeInviteEmail, normalizeInvitePhone } from './academy-invite';

describe('normalizeInvitePhone', () => {
	it('하이픈·공백 제거 후 010 11자리', () => {
		expect(normalizeInvitePhone('010-1234-5678')).toBe('01012345678');
		expect(normalizeInvitePhone(' 010 1234 5678 ')).toBe('01012345678');
	});

	it('+82 국가코드', () => {
		expect(normalizeInvitePhone('+82 10-1234-5678')).toBe('01012345678');
	});

	it('무효 시 null', () => {
		expect(normalizeInvitePhone('0111234567')).toBe(null);
		expect(normalizeInvitePhone('010123456')).toBe(null);
		expect(normalizeInvitePhone('')).toBe(null);
	});
});

describe('normalizeInviteEmail', () => {
	it('트림·소문자', () => {
		expect(normalizeInviteEmail('  User@Example.COM ')).toBe('user@example.com');
	});

	it('무효 시 null', () => {
		expect(normalizeInviteEmail('not-an-email')).toBe(null);
		expect(normalizeInviteEmail('')).toBe(null);
	});
});
