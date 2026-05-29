import { error, fail, redirect } from '@sveltejs/kit';
import { Types } from 'mongoose';

import { withAcademyScope } from '$lib/server/academy-scope';
import { convertLead, LeadConvertError } from '$lib/server/lead-convert';
import { Lead, LEAD_STATUSES, type LeadStatus } from '$lib/server/models/lead';
import {
	ensureStaffAcademyMember,
	failFromGate,
	gateDirectoryAction,
	isElevatedStaffRole
} from '$lib/server/rbac';
import type { Actions, PageServerLoad } from './$types';

function ensureLeadsPageAccess(locals: App.Locals): void {
	const m = ensureStaffAcademyMember(locals);
	if (!isElevatedStaffRole(m.role)) {
		error(403, '상담·대기 큐는 관리자·행정만 이용할 수 있습니다.');
	}
}

function parseObjectId(raw: string | null | undefined): Types.ObjectId | null {
	const v = raw?.trim() ?? '';
	if (!/^[a-f\d]{24}$/i.test(v)) return null;
	return new Types.ObjectId(v);
}

function parseLeadStatus(raw: FormDataEntryValue | null): LeadStatus | null {
	const s = raw?.toString()?.trim() ?? '';
	if (!s || !LEAD_STATUSES.includes(s as LeadStatus)) return null;
	return s as LeadStatus;
}

export const load: PageServerLoad = async ({ locals, params }) => {
	ensureLeadsPageAccess(locals);

	const leadId = parseObjectId(params.id);
	if (!leadId) {
		error(404, '잘못된 상담·대기 ID입니다.');
	}

	try {
		const { academyId } = await withAcademyScope();
		const doc = await Lead.findOne({ _id: leadId, academyId }).lean();
		if (!doc) {
			error(404, '해당 학원에서 상담·대기 건을 찾지 못했습니다.');
		}

		return {
			statusOptions: [...LEAD_STATUSES],
			lead: {
				id: doc!._id.toString(),
				studentName: doc!.studentName,
				guardianName: doc!.guardianName,
				phone: doc!.phone,
				memo: doc!.memo ?? null,
				source: doc!.source,
				status: doc!.status as LeadStatus,
				studentIdHex: doc!.studentId?.toString() ?? null,
				convertedAt: doc!.convertedAt?.toISOString() ?? null,
				enrolledAt: doc!.enrolledAt?.toISOString() ?? null,
				createdAt: doc!.createdAt.toISOString()
			},
			dbError: null as string | null
		};
	} catch (e) {
		console.error('[lead detail load]', e);
		return {
			statusOptions: [...LEAD_STATUSES],
			lead: null as never,
			dbError: 'MongoDB에 연결할 수 없습니다. DB를 띄우고 시드한 뒤 다시 시도하세요.'
		};
	}
};

export const actions: Actions = {
	updateStatus: async ({ locals, params, request }) => {
		const rg = gateDirectoryAction(locals);
		if (!rg.ok) return failFromGate(rg);

		const leadId = parseObjectId(params.id);
		if (!leadId) {
			return fail(400, { error: '잘못된 상담·대기 ID입니다.' });
		}

		let academyId: Types.ObjectId;
		try {
			({ academyId } = await withAcademyScope());
		} catch {
			return fail(503, { error: 'DB에 연결할 수 없습니다.' });
		}

		const fd = await request.formData();
		const status = parseLeadStatus(fd.get('status'));
		if (!status) {
			return fail(400, { error: '잘못된 상태 값입니다.' });
		}

		const closeReason = fd.get('closeReason')?.toString()?.trim() ?? '';
		if (closeReason.length > 200) {
			return fail(400, { error: '종료 사유는 200자 이하로 입력하세요.' });
		}

		const lead = await Lead.findOne({ _id: leadId, academyId });
		if (!lead) {
			return fail(404, { error: '해당 학원에서 상담·대기 건을 찾지 못했습니다.' });
		}

		lead.status = status;
		if (status === 'closed') {
			lead.closeReason = closeReason || undefined;
		} else {
			lead.closeReason = undefined;
		}
		await lead.save();

		return { success: true as const };
	},

	convertLead: async ({ locals, params }) => {
		const rg = gateDirectoryAction(locals);
		if (!rg.ok) return failFromGate(rg);

		const leadId = parseObjectId(params.id);
		if (!leadId) {
			return fail(400, { error: '잘못된 상담·대기 ID입니다.' });
		}

		let academyId: Types.ObjectId;
		try {
			({ academyId } = await withAcademyScope());
		} catch {
			return fail(503, { error: 'DB에 연결할 수 없습니다.' });
		}

		try {
			const { student } = await convertLead({ leadId, academyId });
			throw redirect(303, `/students/${student._id.toString()}/edit`);
		} catch (err) {
			if (err instanceof LeadConvertError) {
				return fail(400, { error: err.message });
			}
			console.error('[lead detail convertLead]', err);
			return fail(500, { error: '학생 전환 중 오류가 발생했습니다.' });
		}
	}
};

