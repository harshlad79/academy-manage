import { describe, it, expect } from 'vitest';
import {
	effectiveAttendanceBefore,
	normalizeAttendanceReasonForStore,
	shouldLogAttendanceChange
} from './attendance-audit';

describe('attendance-audit', () => {
	it('present 는 사유 정규화 시 비움', () => {
		expect(normalizeAttendanceReasonForStore('present', '  공결  ')).toBe('');
		expect(normalizeAttendanceReasonForStore('absent', '  아픔 ')).toBe('아픔');
	});

	it('문서 없으면 이전 상태는 출석·빈 사유', () => {
		expect(effectiveAttendanceBefore(null)).toEqual({ status: 'present', reason: '' });
	});

	it('변경 없으면 로그 생략', () => {
		const prev = { status: 'present' as const, reason: '' };
		expect(shouldLogAttendanceChange(prev, { status: 'present', reason: '' })).toBe(false);
	});

	it('상태 또는 사유가 바뀌면 로그', () => {
		expect(
			shouldLogAttendanceChange({ status: 'present', reason: '' }, { status: 'absent', reason: '' })
		).toBe(true);
		expect(
			shouldLogAttendanceChange(
				{ status: 'absent', reason: 'a' },
				{ status: 'absent', reason: 'b' }
			)
		).toBe(true);
	});
});
