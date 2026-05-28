import { fail, redirect } from '@sveltejs/kit';
import { Types } from 'mongoose';
import { isOidHex } from '$lib/server/active-academy';
import connectDB from '$lib/server/db';
import { applyInviteEmailMeta } from '$lib/server/invite-email-meta';
import {
	buildInviteAcceptUrl,
	type InviteMailEnv,
	inviteMailNoticeMessage,
	inviteMailResultNotice,
	resolveInviteMailOrigin,
	sendAcademyInviteEmail
} from '$lib/server/invite-mail';
import {
	AcademyInquiry,
	type AcademyInquiryStatus
} from '$lib/server/models/academy-inquiry';
import { AcademyInvite } from '$lib/server/models/academy-invite';
import {
	approveInquiryToActive,
	approveInquiryToTrial,
	PlatformInquiryApproveError
} from '$lib/server/platform-inquiry-approve';
import { ensurePlatformSuperAdmin } from '$lib/server/rbac';
import type { Actions, PageServerLoad } from './$types';

const INQUIRY_STATUSES: AcademyInquiryStatus[] = [
	'new',
	'contacted',
	'trial',
	'approved',
	'rejected'
];

const DEFAULT_TRIAL_DAYS = 7;

function parseInquiryId(raw: FormDataEntryValue | null): Types.ObjectId | null {
	const id = raw?.toString()?.trim() ?? '';
	if (!isOidHex(id)) return null;
	return new Types.ObjectId(id);
}

function inquiriesRedirect(notice?: string): never {
	const q = notice ? `?notice=${encodeURIComponent(notice)}` : '';
	redirect(303, `/platform/inquiries${q}`);
}

function approveErrorMessage(err: unknown): string {
	if (err instanceof PlatformInquiryApproveError) return err.message;
	if (err instanceof Error) return err.message;
	return '처리 중 오류가 발생했습니다.';
}

async function dispatchInviteEmail(
	academyId: Types.ObjectId,
	inviteId: Types.ObjectId,
	academyName: string,
	email: string,
	token: string,
	expiresAt: Date,
	requestOrigin: string
): Promise<string> {
	const mailEnv = process.env as InviteMailEnv;
	const originBase = resolveInviteMailOrigin(mailEnv, requestOrigin);
	const acceptUrl = buildInviteAcceptUrl(originBase, token);
	const mailResult = await sendAcademyInviteEmail(
		{
			to: email,
			academyName,
			role: 'academy_admin',
			acceptUrl,
			expiresAt
		},
		{ academyId }
	);
	await applyInviteEmailMeta(inviteId, mailResult);
	return inviteMailResultNotice(mailResult, 'create');
}

export const load: PageServerLoad = async ({ locals, url }) => {
	ensurePlatformSuperAdmin(locals);

	const statusRaw = url.searchParams.get('status')?.trim() ?? '';
	const statusFilter =
		statusRaw && INQUIRY_STATUSES.includes(statusRaw as AcademyInquiryStatus)
			? (statusRaw as AcademyInquiryStatus)
			: null;

	await connectDB();

	const filter = statusFilter ? { status: statusFilter } : {};
	const docs = await AcademyInquiry.find(filter).sort({ createdAt: -1 }).limit(200).lean();

	const academyIds = [
		...new Set(
			docs
				.map((d) => d.academyId?.toString())
				.filter((id): id is string => Boolean(id))
		)
	].map((id) => new Types.ObjectId(id));

	const inviteByAcademyEmail = new Map<string, { token: string; expiresAt: Date }>();
	if (academyIds.length > 0) {
		const invites = await AcademyInvite.find({
			academyId: { $in: academyIds },
			role: 'academy_admin'
		})
			.sort({ createdAt: -1 })
			.select('academyId email token expiresAt')
			.lean();

		for (const inv of invites) {
			const key = `${inv.academyId.toString()}:${inv.email ?? ''}`;
			if (!inviteByAcademyEmail.has(key)) {
				inviteByAcademyEmail.set(key, {
					token: inv.token,
					expiresAt: inv.expiresAt
				});
			}
		}
	}

	const notice = url.searchParams.get('notice');
	const inviteAcceptOrigin = resolveInviteMailOrigin(process.env as InviteMailEnv, url.origin);

	return {
		statusFilter,
		statusOptions: INQUIRY_STATUSES,
		inviteAcceptOrigin,
		notice,
		noticeMessage: inviteMailNoticeMessage(notice),
		rows: docs.map((d) => {
			const id = d._id.toString();
			const academyIdHex = d.academyId?.toString() ?? null;
			const inviteKey = academyIdHex ? `${academyIdHex}:${d.email}` : null;
			const invite = inviteKey ? inviteByAcademyEmail.get(inviteKey) : undefined;
			return {
				id,
				academyName: d.academyName,
				contactName: d.contactName,
				phone: d.phone,
				email: d.email,
				region: d.region,
				memo: d.memo ?? null,
				status: d.status as AcademyInquiryStatus,
				trialDays: d.trialDays ?? null,
				academyIdHex,
				processedAt: d.processedAt?.toISOString() ?? null,
				createdAt: d.createdAt.toISOString(),
				inviteToken: invite?.token ?? null,
				inviteExpiresAt: invite?.expiresAt.toISOString() ?? null,
				inviteAcceptUrl:
					invite?.token != null
						? buildInviteAcceptUrl(inviteAcceptOrigin, invite.token)
						: null
			};
		})
	};
};

export const actions: Actions = {
	markContacted: async ({ request, locals }) => {
		ensurePlatformSuperAdmin(locals);
		const fd = await request.formData();
		const inquiryId = parseInquiryId(fd.get('inquiryId'));
		if (!inquiryId) return fail(400, { error: '잘못된 문의 ID입니다.' });

		await connectDB();
		const inquiry = await AcademyInquiry.findById(inquiryId);
		if (!inquiry) return fail(404, { error: '문의를 찾을 수 없습니다.' });
		if (inquiry.status !== 'new') {
			return fail(400, { error: '신규 접수 문의만 연락 완료로 표시할 수 있습니다.' });
		}

		inquiry.status = 'contacted';
		await inquiry.save();
		inquiriesRedirect();
	},

	approveTrial: async ({ request, locals, url }) => {
		ensurePlatformSuperAdmin(locals);
		const userId = locals.user?.id;
		if (!userId) return fail(401, { error: '로그인이 필요합니다.' });

		const fd = await request.formData();
		const inquiryId = parseInquiryId(fd.get('inquiryId'));
		if (!inquiryId) return fail(400, { error: '잘못된 문의 ID입니다.' });

		const trialDaysRaw = fd.get('trialDays')?.toString()?.trim() ?? '';
		const trialDays = trialDaysRaw ? Number.parseInt(trialDaysRaw, 10) : DEFAULT_TRIAL_DAYS;
		if (!Number.isFinite(trialDays) || trialDays < 1) {
			return fail(400, { error: '체험 기간은 1일 이상의 숫자로 입력하세요.' });
		}

		await connectDB();
		try {
			const { academy, invite, inquiry } = await approveInquiryToTrial({
				inquiryId,
				trialDays,
				processedByUserId: userId
			});
			const notice = await dispatchInviteEmail(
				academy._id,
				invite._id,
				academy.name,
				inquiry.email,
				invite.token,
				invite.expiresAt,
				url.origin
			);
			inquiriesRedirect(notice);
		} catch (err) {
			return fail(400, { error: approveErrorMessage(err) });
		}
	},

	approveActive: async ({ request, locals }) => {
		ensurePlatformSuperAdmin(locals);
		const userId = locals.user?.id;
		if (!userId) return fail(401, { error: '로그인이 필요합니다.' });

		const fd = await request.formData();
		const inquiryId = parseInquiryId(fd.get('inquiryId'));
		if (!inquiryId) return fail(400, { error: '잘못된 문의 ID입니다.' });

		await connectDB();
		try {
			await approveInquiryToActive({
				inquiryId,
				processedByUserId: userId
			});
			inquiriesRedirect();
		} catch (err) {
			return fail(400, { error: approveErrorMessage(err) });
		}
	},

	reject: async ({ request, locals }) => {
		ensurePlatformSuperAdmin(locals);
		const userId = locals.user?.id;
		if (!userId) return fail(401, { error: '로그인이 필요합니다.' });

		const fd = await request.formData();
		const inquiryId = parseInquiryId(fd.get('inquiryId'));
		if (!inquiryId) return fail(400, { error: '잘못된 문의 ID입니다.' });

		await connectDB();
		const inquiry = await AcademyInquiry.findById(inquiryId);
		if (!inquiry) return fail(404, { error: '문의를 찾을 수 없습니다.' });
		if (!['new', 'contacted'].includes(inquiry.status)) {
			return fail(400, { error: '신규·연락 완료 문의만 거절할 수 있습니다.' });
		}

		inquiry.status = 'rejected';
		inquiry.processedByUserId = userId;
		inquiry.processedAt = new Date();
		await inquiry.save();
		inquiriesRedirect();
	}
};
