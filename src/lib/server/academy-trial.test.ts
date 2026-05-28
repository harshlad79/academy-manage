import { describe, expect, it } from 'vitest';
import {
	academyBlocksExternalComms,
	academyBlocksStaffApp,
	isTrialExpired
} from './academy-trial';

describe('academy-trial', () => {
	const ends = new Date('2026-01-10T00:00:00Z');
	const before = new Date('2026-01-09T12:00:00Z');
	const after = new Date('2026-01-11T00:00:00Z');

	it('isTrialExpired when trial past ends', () => {
		expect(isTrialExpired('trial', ends, after)).toBe(true);
		expect(isTrialExpired('trial', ends, before)).toBe(false);
		expect(isTrialExpired('active', ends, after)).toBe(false);
	});

	it('blocks staff app only when trial expired', () => {
		expect(academyBlocksStaffApp('trial', ends, after)).toBe(true);
		expect(academyBlocksStaffApp('trial', ends, before)).toBe(false);
	});

	it('blocks external comms for trial (even not expired)', () => {
		expect(academyBlocksExternalComms('trial', ends, before)).toBe(true);
		expect(academyBlocksExternalComms('active', ends, before)).toBe(false);
	});
});
