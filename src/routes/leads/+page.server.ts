import { error, fail } from '@sveltejs/kit';
import { Types } from 'mongoose';

import { withAcademyScope } from '$lib/server/academy-scope';
import { convertLead, LeadConvertError } from '$lib/server/lead-convert';
import { normalizeInvitePhone } from '$lib/server/models/academy-invite';
import { Lead, LEAD_STATUSES, type LeadStatus } from '$lib/server/models/lead';
import {
	ensureStaffAcademyMember,
	failFromGate,
	gateDirectoryAction,
	isElevatedStaffRole
} from '$lib/server/rbac';
import type { Actions, PageServerLoad } from './$types';

const MAX_NAME = 120;
const MAX_MEMO = 500;

function ensureLeadsPageAccess(locals: App.Locals): void {
	const m = ensureStaffAcademyMember(locals);
	if (!isElevatedStaffRole(m.role)) {
		error(403, '상담·대기 큐는 관리자·행정만 이용할 수 있습니다.');
	}
}

function parseLeadId(raw: FormDataEntryValue | null): Types.ObjectId | null {
	const id = raw?.toString()?.trim() ?? '';
	if (!/^[a-f\d]{24}$/i.test(id)) return null;
	return new Types.ObjectId(id);
}

function parseLeadStatus(raw: FormDataEntryValue | null): LeadStatus | null {
	const s = raw?.toString()?.trim() ?? '';
	if (!s || !LEAD_STATUSES.includes(s as LeadStatus)) return null;
	return s as LeadStatus;
}

function validateStaffLeadFields(
	studentName: string,
	guardianName: string,
	phoneRaw: string,
	memoRaw: string
): { error: string } | { studentName: string; guardianName: string; phone: string; memo?: string } {
	const sn = studentName.trim();
	const gn = guardianName.trim();
	if (!sn) return { error: '학생 이름은 필수입니다.' };
	if (sn.length > MAX_NAME) return { error: `학생 이름은 ${MAX_NAME}자 이하로 입력하세요.` };
	if (!gn) return { error: '보호자명은 필수입니다.' };
	if (gn.length > MAX_NAME) return { error: `보호자명은 ${MAX_NAME}자 이하로 입력하세요.` };
	const phone = normalizeInvitePhone(phoneRaw);
	if (!phone) return { error: '유효한 보호자 휴대번호(010)를 입력하세요.' };
	const memo = memoRaw.trim();
	if (memo.length > MAX_MEMO) return { error: `메모는 ${MAX_MEMO}자 이하로 입력하세요.` };
	return { studentName: sn, guardianName: gn, phone, memo: memo || undefined };
}

export const load: PageServerLoad = async ({ locals, url }) => {
	ensureLeadsPageAccess(locals);

	const statusRaw = url.searchParams.get('status')?.trim() ?? '';
	const statusFilter =
		statusRaw && LEAD_STATUSES.includes(statusRaw as LeadStatus)
			? (statusRaw as LeadStatus)
			: null;

	try {
		const { academyId } = await withAcademyScope();
		const filter: Record<string, unknown> = { academyId };
		if (statusFilter) filter.status = statusFilter;

		const docs = await Lead.find(filter).sort({ createdAt: -1 }).limit(200).lean();
		const academyIdHex = academyId.toString();

		return {
			statusFilter,
			statusOptions: [...LEAD_STATUSES],
			academyIdHex,
			applyUrl: `${url.origin}/apply?a=${academyIdHex}`,
			leads: docs.map((d) => ({
				id: d._id.toString(),
				studentName: d.studentName,
				guardianName: d.guardianName,
				phone: d.phone,
				memo: d.memo ?? null,
				source: d.source,
				status: d.status as LeadStatus,
				studentIdHex: d.studentId?.toString() ?? null,
				convertedAt: d.convertedAt?.toISOString() ?? null,
				enrolledAt: d.enrolledAt?.toISOString() ?? null,
				createdAt: d.createdAt.toISOString()
			})),
			dbError: null as string | null
		};
	} catch (e) {
		console.error('[leads load]', e);
		return {
			statusFilter,
			statusOptions: [...LEAD_STATUSES],
			academyIdHex: null as string | null,
			applyUrl: null as string | null,
			leads: [] as {
				id: string;
				studentName: string;
				guardianName: string;
				phone: string;
				memo: string | null;
				source: 'web' | 'staff';
				status: LeadStatus;
				studentIdHex: string | null;
				convertedAt: string | null;
				enrolledAt: string | null;
				createdAt: string;
			}[],
			dbError: 'MongoDB에 연결할 수 없습니다. DB를 띄우고 시드한 뒤 다시 시도하세요.'
		};
	}
};

export const actions: Actions = {
	updateStatus: async ({ request, locals }) => {
		const rg = gateDirectoryAction(locals);
		if (!rg.ok) return failFromGate(rg);

		let academyId: Types.ObjectId;
		try {
			({ academyId } = await withAcademyScope());
		} catch {
			return fail(503, { error: 'DB에 연결할 수 없습니다.' });
		}

		const fd = await request.formData();
		const leadId = parseLeadId(fd.get('leadId'));
		const status = parseLeadStatus(fd.get('status'));
		if (!leadId) return fail(400, { error: '잘못된 상담·대기 ID입니다.' });
		if (!status) return fail(400, { error: '잘못된 상태 값입니다.' });

		const closeReason = fd.get('closeReason')?.toString()?.trim() ?? '';
		if (closeReason.length > 200) {
			return fail(400, { error: '종료 사유는 200자 이하로 입력하세요.' });
		}

		const lead = await Lead.findOne({ _id: leadId, academyId });
		if (!lead) return fail(404, { error: '해당 학원에서 상담·대기 건을 찾지 못했습니다.' });

		lead.status = status;
		if (status === 'closed') {
			lead.closeReason = closeReason || undefined;
		} else {
			lead.closeReason = undefined;
		}
		await lead.save();
		return { success: true as const };
	},

	createStaffLead: async ({ request, locals }) => {
		const rg = gateDirectoryAction(locals);
		if (!rg.ok) return failFromGate(rg);

		const userId = locals.user?.id;
		if (!userId) return fail(401, { error: '로그인이 필요합니다.' });

		let academyId: Types.ObjectId;
		try {
			({ academyId } = await withAcademyScope());
		} catch {
			return fail(503, { error: 'DB에 연결할 수 없습니다.' });
		}

		const fd = await request.formData();
		const v = validateStaffLeadFields(
			String(fd.get('studentName') ?? ''),
			String(fd.get('guardianName') ?? ''),
			String(fd.get('phone') ?? ''),
			String(fd.get('memo') ?? '')
		);
		if ('error' in v) return fail(400, { error: v.error });

		await Lead.create({
			academyId,
			studentName: v.studentName,
			guardianName: v.guardianName,
			phone: v.phone,
			memo: v.memo,
			source: 'staff',
			status: 'new',
			createdByUserId: userId
		});
		return { success: true as const };
	},

	convertLead: async ({ request, locals }) => {
		const rg = gateDirectoryAction(locals);
		if (!rg.ok) return failFromGate(rg);

		let academyId: Types.ObjectId;
		try {
			({ academyId } = await withAcademyScope());
		} catch {
			return fail(503, { error: 'DB에 연결할 수 없습니다.' });
		}

		const fd = await request.formData();
		const leadId = parseLeadId(fd.get('leadId'));
		if (!leadId) return fail(400, { error: '잘못된 상담·대기 ID입니다.' });

		try {
			const { student } = await convertLead({ leadId, academyId });
			return {
				success: true as const,
				studentId: student._id.toString()
			};
		} catch (err) {
			if (err instanceof LeadConvertError) {
				return fail(400, { error: err.message });
			}
			console.error('[leads convertLead]', err);
			return fail(500, { error: '학생 전환 중 오류가 발생했습니다.' });
		}
	}
};
