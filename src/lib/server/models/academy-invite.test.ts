import { describe, expect, it } from 'vitest';

import {
	normalizeInviteEmail,
	normalizeInvitePhone,
	validateInviteChannelFields
} from './academy-invite';

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

describe('validateInviteChannelFields', () => {
	it('parent는 phone만', () => {
		const r = validateInviteChannelFields('parent', '', '010-1234-5678');
		expect(r.ok).toBe(true);
		if (r.ok) expect(r.fields).toEqual({ phone: '01012345678' });
	});

	it('parent에 email 있으면 거부', () => {
		expect(validateInviteChannelFields('parent', 'a@b.co', '01012345678').ok).toBe(false);
	});

	it('teacher는 email만', () => {
		const r = validateInviteChannelFields('teacher', 'T@Example.com', '');
		expect(r.ok).toBe(true);
		if (r.ok) expect(r.fields).toEqual({ email: 't@example.com' });
	});

	it('teacher에 phone 있으면 거부', () => {
		expect(validateInviteChannelFields('teacher', 't@ex.com', '01012345678').ok).toBe(false);
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
