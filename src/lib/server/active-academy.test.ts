import { describe, it, expect } from 'vitest';
import {
	academyAllowsResolvedContext,
	academyAllowsStaffContext,
	isOidHex
} from './active-academy';

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

	it('academyAllowsResolvedContext — 비활성은 super_admin 또는 parent', () => {
		expect(academyAllowsResolvedContext('inactive', 'parent')).toBe(true);
		expect(academyAllowsResolvedContext('inactive', 'office')).toBe(false);
		expect(academyAllowsResolvedContext('active', 'office')).toBe(true);
	});
});
