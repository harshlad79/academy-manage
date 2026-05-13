import { getRequestEvent } from '$app/server';
import connectDB from '$lib/server/db';
import { getDefaultAcademyId } from '$lib/server/dev-academy';
import type { Types } from 'mongoose';

/** 목록·CRUD에서 동일 학원 스코프를 쓰기 위한 헬퍼 — 활성 학원 쿠키·멤버십이 있으면 그 학원, 없으면 `DEV_ACADEMY_ID` */
export async function withAcademyScope(): Promise<{
	academyId: Types.ObjectId;
}> {
	await connectDB();
	try {
		const { locals } = getRequestEvent();
		if (locals.activeAcademyId) {
			return { academyId: locals.activeAcademyId };
		}
	} catch {
		// 요청 컨텍스트 없음(프리렌더 등)
	}
	return { academyId: getDefaultAcademyId() };
}
