import { withAcademyScope } from '$lib/server/academy-scope';
import { formatSeoulYearMonth, seoulMonthRange } from '$lib/server/date-seoul';
import {
	computeCourseRevenueRows,
	type CourseRevenueRow
} from '$lib/server/reports/course-revenue-aggregate';
import { ensureStaffAcademyMember } from '$lib/server/rbac';
import type { PageServerLoad } from './$types';

export type { CourseRevenueRow };

export const load: PageServerLoad = async ({ url, locals }) => {
	const m = ensureStaffAcademyMember(locals);

	const defaultMonth = formatSeoulYearMonth();
	const monthRaw = url.searchParams.get('month')?.trim();
	const monthCandidate = monthRaw && monthRaw.length > 0 ? monthRaw : defaultMonth;
	const range = seoulMonthRange(monthCandidate);
	const monthParam = range ? monthCandidate : defaultMonth;
	const monthInvalid = Boolean(monthRaw && monthRaw.length > 0 && !range);
	const bounds = range ?? seoulMonthRange(defaultMonth)!;
	const { start, endExclusive } = bounds;

	try {
		const { academyId } = await withAcademyScope();

		const { rows, scopeWarning } = await computeCourseRevenueRows({
			academyId,
			membership: m,
			start,
			endExclusive
		});

		return {
			monthParam,
			monthInvalid,
			rows,
			dbError: null as string | null,
			scopeWarning
		};
	} catch (e) {
		console.error('[course-revenue load]', e);
		return {
			monthParam,
			monthInvalid,
			rows: [] as CourseRevenueRow[],
			dbError: '데이터를 불러오지 못했습니다.',
			scopeWarning: null as string | null
		};
	}
};
