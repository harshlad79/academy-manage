import { describe, expect, it } from 'vitest';
import { formatSeoulDateString, isYmdSeoulCalendarDate, seoulMonthRange } from './date-seoul';

describe('date-seoul', () => {
	it('formatSeoulDateString returns YYYY-MM-DD', () => {
		expect(formatSeoulDateString(new Date('2026-05-11T12:00:00Z'))).toMatch(/^\d{4}-\d{2}-\d{2}$/);
	});

	it('isYmdSeoulCalendarDate', () => {
		expect(isYmdSeoulCalendarDate('2026-05-11')).toBe(true);
		expect(isYmdSeoulCalendarDate('2026-13-01')).toBe(false);
		expect(isYmdSeoulCalendarDate('bad')).toBe(false);
	});

	it('seoulMonthRange', () => {
		const r = seoulMonthRange('2026-03');
		expect(r).not.toBeNull();
		const days = (r!.endExclusive.getTime() - r!.start.getTime()) / 86400000;
		expect(days).toBe(31);
		expect(seoulMonthRange('2026-13')).toBeNull();
		expect(seoulMonthRange('bad')).toBeNull();
	});
});
