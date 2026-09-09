import { describe, expect, it } from 'vitest';
import { academyAllowsCommunications, academyAllowsParentPortal } from './academy-flags';

describe('academy flags gate', () => {
	it('treats missing academy or flag as enabled (legacy docs)', () => {
		expect(academyAllowsParentPortal(null)).toBe(true);
		expect(academyAllowsParentPortal(undefined)).toBe(true);
		expect(academyAllowsParentPortal({} as { parentPortalEnabled?: boolean })).toBe(true);
		expect(academyAllowsCommunications(undefined)).toBe(true);
	});

	it('respects explicit flags', () => {
		expect(academyAllowsParentPortal({ parentPortalEnabled: false })).toBe(false);
		expect(academyAllowsParentPortal({ parentPortalEnabled: true })).toBe(true);
		expect(academyAllowsCommunications({ communicationsEnabled: false })).toBe(false);
		expect(academyAllowsCommunications({ communicationsEnabled: true })).toBe(true);
	});
});
