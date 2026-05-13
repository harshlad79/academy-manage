import { Types } from 'mongoose';
import connectDB from '$lib/server/db';
import { getDefaultAcademyId } from '$lib/server/dev-academy';
import { Academy } from '$lib/server/models/academy';
import { AcademyMembership } from '$lib/server/models/academy-membership';
import type { AcademyMembershipLocals, AcademyRole } from '$lib/server/rbac';

/** 브라우저에 저장하는 활성 학원 ObjectId(hex). httpOnly 쿠키. */
export const ACTIVE_ACADEMY_COOKIE = 'active_academy_id';

export function isOidHex(s: string): boolean {
	return /^[a-f\d]{24}$/i.test(s.trim());
}

/** 비활성 학원은 `super_admin` 멤버십만 업무 맥락으로 사용(정리·재활성화용). */
export function academyAllowsStaffContext(
	academyStatus: 'active' | 'inactive' | undefined,
	role: AcademyRole
): boolean {
	if (!academyStatus) return false;
	if (academyStatus === 'active') return true;
	return role === 'super_admin';
}

/**
 * 쿠키·기본 학원 해석 및 전환에 사용.
 * 비활성 학원은 `super_admin`(업무) 또는 `parent`(포털 열람)만 허용.
 */
export function academyAllowsResolvedContext(
	academyStatus: 'active' | 'inactive' | undefined,
	role: AcademyRole
): boolean {
	if (!academyStatus) return false;
	if (academyStatus === 'active') return true;
	return role === 'super_admin' || role === 'parent';
}

export type ResolvedAcademyContext = {
	academyId: Types.ObjectId;
	membership: AcademyMembershipLocals;
	/** 스태프 레이아웃 가드·배너용 */
	academyOperationalStatus: 'active' | 'inactive';
};

type MemRow = {
	academyId: Types.ObjectId;
	role: AcademyRole;
	linkedTeacherId?: Types.ObjectId;
};

async function loadAcademyStatusMap(
	academyIds: Types.ObjectId[]
): Promise<Map<string, 'active' | 'inactive'>> {
	if (academyIds.length === 0) return new Map();
	const docs = await Academy.find({ _id: { $in: academyIds } })
		.select('status')
		.lean();
	const m = new Map<string, 'active' | 'inactive'>();
	for (const d of docs) {
		m.set(d._id.toString(), d.status);
	}
	return m;
}

async function rowUsable(
	row: MemRow,
	statusMap: Map<string, 'active' | 'inactive'>
): Promise<boolean> {
	const st = statusMap.get(row.academyId.toString());
	return academyAllowsResolvedContext(st, row.role);
}

function toContext(
	row: MemRow,
	statusMap: Map<string, 'active' | 'inactive'>
): ResolvedAcademyContext {
	const st = statusMap.get(row.academyId.toString());
	const academyOperationalStatus: 'active' | 'inactive' = st === 'inactive' ? 'inactive' : 'active';
	return {
		academyId: row.academyId,
		membership: {
			role: row.role,
			linkedTeacherId: row.linkedTeacherId?.toString() ?? null
		},
		academyOperationalStatus
	};
}

/**
 * 쿠키(유효·멤버십·학원 상태) → 기본 학원 → 그 외 멤버십 순으로,
 * **비활성 학원은 super_admin 또는 parent 만** 선택된다.
 */
export async function resolveActiveAcademyContext(
	userId: string,
	cookieAcademyIdHex: string | undefined
): Promise<ResolvedAcademyContext | null> {
	await connectDB();
	const defaultId = getDefaultAcademyId();
	const cookieTrim = cookieAcademyIdHex?.trim();

	const allRows = await AcademyMembership.find({ userId }).sort({ createdAt: 1 }).lean();
	if (allRows.length === 0) return null;

	const ids = [...new Set(allRows.map((r) => r.academyId.toString()))].map(
		(s) => new Types.ObjectId(s)
	);
	const statusMap = await loadAcademyStatusMap(ids);

	const tryIds: Types.ObjectId[] = [];
	const seen = new Set<string>();
	const push = (id: Types.ObjectId) => {
		const k = id.toString();
		if (seen.has(k)) return;
		seen.add(k);
		tryIds.push(id);
	};
	if (cookieTrim && isOidHex(cookieTrim)) push(new Types.ObjectId(cookieTrim));
	push(defaultId);

	for (const aid of tryIds) {
		const raw = await AcademyMembership.findOne({ userId, academyId: aid }).lean();
		if (!raw) continue;
		const row: MemRow = {
			academyId: raw.academyId,
			role: raw.role as AcademyRole,
			linkedTeacherId: raw.linkedTeacherId
		};
		if (await rowUsable(row, statusMap)) return toContext(row, statusMap);
	}

	for (const raw of allRows) {
		const row: MemRow = {
			academyId: raw.academyId,
			role: raw.role as AcademyRole,
			linkedTeacherId: raw.linkedTeacherId
		};
		if (await rowUsable(row, statusMap)) return toContext(row, statusMap);
	}

	return null;
}

export type AcademySwitcherItem = { id: string; name: string; status: string };

export type AcademySwitcherData = {
	formAction: string;
	currentId: string;
	items: AcademySwitcherItem[];
};

export async function buildAcademySwitcherData(options: {
	userId: string;
	activeAcademyId: Types.ObjectId;
	formAction: string;
}): Promise<AcademySwitcherData | null> {
	const { userId, activeAcademyId, formAction } = options;
	await connectDB();
	const mems = await AcademyMembership.find({ userId }).lean();
	if (mems.length === 0) return null;
	const ids = [...new Set(mems.map((m) => m.academyId.toString()))].map(
		(s) => new Types.ObjectId(s)
	);
	const statusMap = await loadAcademyStatusMap(ids);
	const usable = new Set<string>();
	for (const m of mems) {
		const st = statusMap.get(m.academyId.toString());
		if (academyAllowsResolvedContext(st, m.role as AcademyRole)) usable.add(m.academyId.toString());
	}
	if (usable.size < 2) return null;
	const docs = await Academy.find({
		_id: { $in: [...usable].map((s) => new Types.ObjectId(s)) }
	})
		.select('name status')
		.sort({ name: 1 })
		.lean();
	return {
		formAction,
		currentId: activeAcademyId.toString(),
		items: docs.map((d) => ({
			id: d._id.toString(),
			name: d.name,
			status: d.status
		}))
	};
}
