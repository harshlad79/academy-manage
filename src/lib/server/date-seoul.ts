/** 캘린더 날짜 `YYYY-MM-DD` (Asia/Seoul, PRD §3). */
export function formatSeoulDateString(d: Date = new Date()): string {
	return new Intl.DateTimeFormat('en-CA', {
		timeZone: 'Asia/Seoul',
		year: 'numeric',
		month: '2-digit',
		day: '2-digit'
	}).format(d);
}

/**
 * `YYYY-MM` 한 달의 `[start, endExclusive)` (입금일 등 서울 달력 기준).
 * 잘못된 입력이면 `null`.
 */
export function seoulMonthRange(ym: string): { start: Date; endExclusive: Date } | null {
	if (!/^\d{4}-\d{2}$/.test(ym)) return null;
	const [yStr, mStr] = ym.split('-');
	const y = Number(yStr);
	const m = Number(mStr);
	if (!Number.isInteger(y) || m < 1 || m > 12) return null;
	const start = new Date(`${y}-${String(m).padStart(2, '0')}-01T00:00:00+09:00`);
	const ny = m === 12 ? y + 1 : y;
	const nm = m === 12 ? 1 : m + 1;
	const endExclusive = new Date(`${ny}-${String(nm).padStart(2, '0')}-01T00:00:00+09:00`);
	return { start, endExclusive };
}

/** 현재 시각 기준 서울 달력의 `YYYY-MM` */
export function formatSeoulYearMonth(d: Date = new Date()): string {
	return formatSeoulDateString(d).slice(0, 7);
}

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

export function isYmdSeoulCalendarDate(s: string): boolean {
	if (!DATE_RE.test(s)) return false;
	const [y, m, d] = s.split('-').map(Number);
	if (m < 1 || m > 12 || d < 1 || d > 31) return false;
	const dt = new Date(y, m - 1, d);
	return dt.getFullYear() === y && dt.getMonth() === m - 1 && dt.getDate() === d;
}
