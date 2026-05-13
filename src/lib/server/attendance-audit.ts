import type { AttendanceDoc, AttendanceStatus } from '$lib/server/models/attendance';

/** DB에 저장된 값과 동일하게 사유 정규화 (present 는 빈 사유; 그 외 trim) */
export function normalizeAttendanceReasonForStore(
	status: AttendanceStatus,
	reason: string
): string {
	const trimmed = reason.trim();
	return status === 'present' ? '' : trimmed;
}

/** UI·기본값과 맞춘 "이전 상태" (문서 없으면 출석·사유 없음으로 간주) */
export function effectiveAttendanceBefore(
	existing: Pick<AttendanceDoc, 'status' | 'reason'> | null
): { status: AttendanceStatus; reason: string } {
	if (!existing) {
		return { status: 'present', reason: '' };
	}
	return {
		status: existing.status,
		reason: normalizeAttendanceReasonForStore(existing.status, existing.reason?.trim() ?? '')
	};
}

export function shouldLogAttendanceChange(
	prev: { status: AttendanceStatus; reason: string },
	next: { status: AttendanceStatus; reason: string }
): boolean {
	return prev.status !== next.status || prev.reason !== next.reason;
}

export function attendanceStatusLabelKo(s: AttendanceStatus): string {
	switch (s) {
		case 'present':
			return '출석';
		case 'late':
			return '지각';
		case 'absent':
			return '결석';
		default: {
			const _x: never = s;
			return _x;
		}
	}
}
