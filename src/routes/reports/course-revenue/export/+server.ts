import { withAcademyScope } from '$lib/server/academy-scope';
import { formatSeoulYearMonth, seoulMonthRange } from '$lib/server/date-seoul';
import {
	computeCourseRevenueRows,
	type CourseRevenueRow
} from '$lib/server/reports/course-revenue-aggregate';
import { ensureStaffAcademyMember } from '$lib/server/rbac';
import type { RequestHandler } from './$types';

function escapeCsvCell(value: string | number): string {
	const s = String(value);
	if (/[",\r\n]/.test(s)) {
		return `"${s.replace(/"/g, '""')}"`;
	}
	return s;
}

/** UTF-8 BOM + CRLF rows for Excel-friendly CSV */
function buildCourseRevenueCsv(rows: CourseRevenueRow[]): string {
	const header = [
		escapeCsvCell('클래스'),
		escapeCsvCell('강사'),
		escapeCsvCell('월수납건수'),
		escapeCsvCell('월수납합계'),
		escapeCsvCell('미납건수'),
		escapeCsvCell('미납합계')
	].join(',');
	const lines = [header];
	for (const row of rows) {
		lines.push(
			[
				escapeCsvCell(row.courseName),
				escapeCsvCell(row.teacherName),
				escapeCsvCell(row.paidCount),
				escapeCsvCell(row.paidTotalKrw),
				escapeCsvCell(row.openCount),
				escapeCsvCell(row.openTotalKrw)
			].join(',')
		);
	}
	return '\uFEFF' + lines.join('\r\n');
}

export const GET: RequestHandler = async ({ url, locals }) => {
	const m = ensureStaffAcademyMember(locals);

	const defaultMonth = formatSeoulYearMonth();
	const monthRaw = url.searchParams.get('month')?.trim();
	const monthCandidate = monthRaw && monthRaw.length > 0 ? monthRaw : defaultMonth;
	const range = seoulMonthRange(monthCandidate);
	const monthForFile = range ? monthCandidate : defaultMonth;
	const bounds = range ?? seoulMonthRange(defaultMonth)!;
	const { start, endExclusive } = bounds;

	let rows: CourseRevenueRow[];
	try {
		const { academyId } = await withAcademyScope();
		const result = await computeCourseRevenueRows({
			academyId,
			membership: m,
			start,
			endExclusive
		});
		rows = result.rows;
	} catch (err) {
		console.error('[course-revenue export]', err);
		return new Response('데이터를 불러오지 못했습니다.', {
			status: 503,
			headers: { 'Content-Type': 'text/plain; charset=utf-8' }
		});
	}

	const body = buildCourseRevenueCsv(rows);
	const asciiName = `course-revenue-${monthForFile}.csv`;
	const utf8NameEnc = encodeURIComponent(`클래스별-정산-${monthForFile}.csv`);

	return new Response(body, {
		headers: {
			'Content-Type': 'text/csv; charset=utf-8',
			'Content-Disposition': `attachment; filename="${asciiName}"; filename*=UTF-8''${utf8NameEnc}`
		}
	});
};
