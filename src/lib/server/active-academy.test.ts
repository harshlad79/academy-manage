import { describe, it, expect } from 'vitest';
import {
	academyAllowsResolvedContext,
	academyAllowsStaffContext,
	deriveAcademyOperationalStatus,
	isOidHex
} from './active-academy';

const trialEnds = new Date('2026-01-10T00:00:00Z');
const beforeTrialEnd = new Date('2026-01-09T12:00:00Z');
const afterTrialEnd = new Date('2026-01-11T00:00:00Z');

describe('active-academy', () => {
	it('isOidHex', () => {
		expect(isOidHex('507f1f77bcf86cd799439011')).toBe(true);
		expect(isOidHex('not')).toBe(false);
		expect(isOidHex('')).toBe(false);
	});

	it('academyAllowsStaffContext — 비활성은 super_admin 만', () => {
		expect(academyAllowsStaffContext('active', 'teacher')).toBe(true);
		expect(academyAllowsStaffContext('inactive', 'teacher')).toBe(false);
		expect(academyAllowsStaffContext('inactive', 'super_admin')).toBe(true);
		expect(academyAllowsStaffContext(undefined, 'super_admin')).toBe(false);
	});

	it('academyAllowsStaffContext — trial 미만료는 active 와 동일', () => {
		expect(academyAllowsStaffContext('trial', 'teacher', trialEnds, beforeTrialEnd)).toBe(
			true
		);
		expect(academyAllowsStaffContext('trial', 'office', trialEnds, beforeTrialEnd)).toBe(true);
	});

	it('academyAllowsStaffContext — trial 만료는 inactive 와 동일', () => {
		expect(academyAllowsStaffContext('trial', 'teacher', trialEnds, afterTrialEnd)).toBe(false);
		expect(academyAllowsStaffContext('trial', 'super_admin', trialEnds, afterTrialEnd)).toBe(
			true
		);
	});

	it('academyAllowsResolvedContext — 비활성은 super_admin 또는 parent', () => {
		expect(academyAllowsResolvedContext('inactive', 'parent')).toBe(true);
		expect(academyAllowsResolvedContext('inactive', 'office')).toBe(false);
		expect(academyAllowsResolvedContext('active', 'office')).toBe(true);
	});

	it('academyAllowsResolvedContext — trial 미만료는 active 와 동일', () => {
		expect(academyAllowsResolvedContext('trial', 'parent', trialEnds, beforeTrialEnd)).toBe(
			true
		);
		expect(academyAllowsResolvedContext('trial', 'teacher', trialEnds, beforeTrialEnd)).toBe(
			true
		);
	});

	it('academyAllowsResolvedContext — trial 만료는 inactive 와 동일', () => {
		expect(academyAllowsResolvedContext('trial', 'parent', trialEnds, afterTrialEnd)).toBe(
			true
		);
		expect(academyAllowsResolvedContext('trial', 'teacher', trialEnds, afterTrialEnd)).toBe(
			false
		);
		expect(academyAllowsResolvedContext('trial', 'super_admin', trialEnds, afterTrialEnd)).toBe(
			true
		);
	});

	it('deriveAcademyOperationalStatus', () => {
		expect(deriveAcademyOperationalStatus('active')).toBe('active');
		expect(deriveAcademyOperationalStatus('inactive')).toBe('inactive');
		expect(deriveAcademyOperationalStatus('trial', trialEnds, beforeTrialEnd)).toBe('active');
		expect(deriveAcademyOperationalStatus('trial', trialEnds, afterTrialEnd)).toBe(
			'trial_locked'
		);
	});
});
