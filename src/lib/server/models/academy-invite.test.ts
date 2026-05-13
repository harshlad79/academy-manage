import { describe, expect, it } from 'vitest';

import { normalizeInviteEmail } from './academy-invite';

describe('normalizeInviteEmail', () => {
	it('트림·소문자', () => {
		expect(normalizeInviteEmail('  User@Example.COM ')).toBe('user@example.com');
	});

	it('무효 시 null', () => {
		expect(normalizeInviteEmail('not-an-email')).toBe(null);
		expect(normalizeInviteEmail('')).toBe(null);
	});
});
