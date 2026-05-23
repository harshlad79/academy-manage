import { error, fail, redirect } from '@sveltejs/kit';
import { Types } from 'mongoose';
import { withAcademyScope } from '$lib/server/academy-scope';
import connectDB from '$lib/server/db';
import { Academy } from '$lib/server/models/academy';
import {
	AcademyInvite,
	defaultInviteExpiresAt,
	generateInviteToken,
	normalizeInvitePhone,
	validateInviteChannelFields
} from '$lib/server/models/academy-invite';
import { AcademyMembership } from '$lib/server/models/academy-membership';
import { ParentStudentLink } from '$lib/server/models/parent-student-link';
import { Student } from '$lib/server/models/student';
import {
	type InviteMailEnv,
	inviteMailNoticeMessage,
	resolveInviteMailOrigin
} from '$lib/server/invite-mail';
import { dispatchInviteSms, inviteSmsNoticeMessage } from '$lib/server/invite-sms';
import { ensureDirectoryAccess, failFromGate, gateDirectoryAction } from '$lib/server/rbac';
import type { Actions, PageServerLoad } from './$types';

const MAX_NAME = 120;
const MAX_GRADE = 40;
const MAX_GUARDIAN_NAME = 80;

function isOid(id: string): boolean {
	return /^[a-f\d]{24}$/i.test(id);
}

/** Better Auth user.id 의 안전 범위. 영문/숫자/일부 구분자 허용. */
const USER_ID_RE = /^[A-Za-z0-9._@:+-]{1,128}$/;

function editRedirect(studentId: string, notice: string): never {
	redirect(303, `/students/${studentId}/edit?notice=${encodeURIComponent(notice)}`);
}

export const load: PageServerLoad = async ({ params, locals, url }) => {
	ensureDirectoryAccess(locals);
	if (!params.id || !isOid(params.id)) error(404, '학생을 찾을 수 없습니다.');
	try {
		const { academyId } = await withAcademyScope();
		const s = await Student.findOne({ _id: params.id, academyId }).lean();
		if (!s) error(404, '학생을 찾을 수 없습니다.');

		const parentMemberships = await AcademyMembership.find({ academyId, role: 'parent' })
			.select('userId')
			.sort({ userId: 1 })
			.lean();
		const links = await ParentStudentLink.find({ academyId, studentId: params.id })
			.sort({ createdAt: 1 })
			.lean();

		const linkedSet = new Set(links.map((l) => l.parentUserId));
		const linkedParents = links.map((l) => ({ parentUserId: l.parentUserId }));
		const candidateParents = parentMemberships
			.filter((m) => !linkedSet.has(m.userId))
			.map((m) => ({ parentUserId: m.userId }));

		let pendingParentInvite: {
			id: string;
			phone: string;
			expiresAt: string;
			token: string;
			lastSmsSentAt: string | null;
			lastSmsError: string | null;
		} | null = null;
		if (s.guardianPhone) {
			const inv = await AcademyInvite.findOne({
				academyId,
				role: 'parent',
				phone: s.guardianPhone
			}).lean();
			if (inv) {
				pendingParentInvite = {
					id: inv._id.toString(),
					phone: inv.phone ?? s.guardianPhone,
					expiresAt: inv.expiresAt.toISOString(),
					token: inv.token,
					lastSmsSentAt: inv.lastSmsSentAt?.toISOString() ?? null,
					lastSmsError: inv.lastSmsError ?? null
				};
			}
		}

		const academy = await Academy.findById(academyId).select('name').lean();
		const notice = url.searchParams.get('notice');

		return {
			student: {
				id: s._id.toString(),
				name: s.name,
				grade: s.grade ?? '',
				guardianName: s.guardianName ?? '',
				guardianPhone: s.guardianPhone ?? ''
			},
			linkedParents,
			candidateParents,
			pendingParentInvite,
			academyName: academy?.name ?? '학원',
			inviteAcceptOrigin: resolveInviteMailOrigin(process.env as InviteMailEnv, url.origin),
			noticeMessage: inviteMailNoticeMessage(notice) ?? inviteSmsNoticeMessage(notice)
		};
	} catch (e) {
		console.error('[student edit load]', e);
		error(503, '데이터베이스에 연결할 수 없습니다.');
	}
};

function validate(
	name: string,
	grade: string | undefined,
	guardianName: string | undefined,
	guardianPhoneRaw: string | undefined
) {
	const n = name.trim();
	if (!n) return { error: '이름은 필수입니다.' as const };
	if (n.length > MAX_NAME) return { error: `이름은 ${MAX_NAME}자 이하로 입력하세요.` as const };
	const g = grade?.trim();
	if (g && g.length > MAX_GRADE)
		return { error: `학년은 ${MAX_GRADE}자 이하로 입력하세요.` as const };
	const gn = guardianName?.trim() ?? '';
	if (gn.length > MAX_GUARDIAN_NAME)
		return { error: `보호자 이름은 ${MAX_GUARDIAN_NAME}자 이하로 입력하세요.` as const };
	let guardianPhone: string | undefined;
	if (guardianPhoneRaw?.trim()) {
		const p = normalizeInvitePhone(guardianPhoneRaw);
		if (!p) return { error: '보호자 휴대번호 형식이 올바르지 않습니다(010).' as const };
		guardianPhone = p;
	}
	return { name: n, grade: g || undefined, guardianName: gn || undefined, guardianPhone } as const;
}

async function createParentInviteForPhone(
	academyId: Types.ObjectId,
	academyName: string,
	phone: string,
	requestOrigin: string,
	createdByUserId?: string
): Promise<string> {
	await connectDB();
	await AcademyInvite.deleteMany({ academyId, phone });
	const token = generateInviteToken();
	const expiresAt = defaultInviteExpiresAt();
	const created = await AcademyInvite.create({
		academyId,
		phone,
		role: 'parent',
		token,
		expiresAt,
		...(createdByUserId ? { createdByUserId } : {})
	});
	return dispatchInviteSms(
		created._id,
		academyName,
		phone,
		token,
		expiresAt,
		requestOrigin,
		'create'
	);
}

export const actions: Actions = {
	update: async ({ request, params, locals }) => {
		const rg = gateDirectoryAction(locals);
		if (!rg.ok) return failFromGate(rg);
		if (!params.id || !isOid(params.id)) return fail(400, { error: '잘못된 ID입니다.' });
		let academyId;
		try {
			({ academyId } = await withAcademyScope());
		} catch {
			return fail(503, { error: 'DB에 연결할 수 없습니다.' });
		}
		const data = await request.formData();
		const v = validate(
			String(data.get('name') ?? ''),
			String(data.get('grade') ?? ''),
			String(data.get('guardianName') ?? ''),
			String(data.get('guardianPhone') ?? '')
		);
		if ('error' in v) return fail(400, { error: v.error });
		const result = await Student.updateOne(
			{ _id: params.id, academyId },
			{
				$set: {
					name: v.name,
					grade: v.grade,
					guardianName: v.guardianName,
					guardianPhone: v.guardianPhone
				}
			}
		);
		if (result.matchedCount === 0) return fail(404, { error: '해당 학생을 찾지 못했습니다.' });
		redirect(303, `/students/${params.id}/edit`);
	},

	createParentSmsInvite: async ({ request, params, locals, url }) => {
		const rg = gateDirectoryAction(locals);
		if (!rg.ok) return failFromGate(rg);
		if (!params.id || !isOid(params.id)) return fail(400, { error: '잘못된 ID입니다.' });
		let academyId;
		try {
			({ academyId } = await withAcademyScope());
		} catch {
			return fail(503, { error: 'DB에 연결할 수 없습니다.' });
		}
		const fd = await request.formData();
		const phoneRaw =
			fd.get('phone')?.toString()?.trim() || fd.get('guardianPhone')?.toString()?.trim() || '';
		const channel = validateInviteChannelFields('parent', '', phoneRaw);
		if (!channel.ok) return fail(400, { error: channel.error });
		if (!('phone' in channel.fields) || !channel.fields.phone) {
			return fail(400, { error: '휴대번호가 필요합니다.' });
		}
		const phone = channel.fields.phone;
		await connectDB();
		const s = await Student.findOne({ _id: params.id, academyId }).lean();
		if (!s) return fail(404, { error: '학생을 찾을 수 없습니다.' });
		if (!s.guardianPhone || s.guardianPhone !== phone) {
			await Student.updateOne({ _id: params.id, academyId }, { $set: { guardianPhone: phone } });
		}
		const academy = await Academy.findById(academyId).lean();
		const notice = await createParentInviteForPhone(
			academyId,
			academy?.name ?? '학원',
			phone,
			url.origin,
			locals.user?.id
		);
		editRedirect(params.id, notice);
	},

	resendParentSmsInvite: async ({ request, params, locals, url }) => {
		const rg = gateDirectoryAction(locals);
		if (!rg.ok) return failFromGate(rg);
		if (!params.id || !isOid(params.id)) return fail(400, { error: '잘못된 ID입니다.' });
		let academyId;
		try {
			({ academyId } = await withAcademyScope());
		} catch {
			return fail(503, { error: 'DB에 연결할 수 없습니다.' });
		}
		const inviteIdRaw = (await request.formData()).get('inviteId')?.toString()?.trim() ?? '';
		if (!isOid(inviteIdRaw)) return fail(400, { error: '잘못된 초대 ID입니다.' });
		await connectDB();
		const inv = await AcademyInvite.findOne({
			_id: inviteIdRaw,
			academyId,
			role: 'parent'
		}).lean();
		if (!inv?.phone) return fail(404, { error: '초대를 찾을 수 없습니다.' });
		if (inv.expiresAt.getTime() < Date.now()) {
			return fail(400, { error: '만료된 초대입니다. 새로 초대하세요.' });
		}
		const academy = await Academy.findById(academyId).lean();
		const notice = await dispatchInviteSms(
			new Types.ObjectId(inviteIdRaw),
			academy?.name ?? '학원',
			inv.phone,
			inv.token,
			inv.expiresAt,
			url.origin,
			'resend'
		);
		editRedirect(params.id, notice);
	},

	linkParent: async ({ request, params, locals }) => {
		const rg = gateDirectoryAction(locals);
		if (!rg.ok) return failFromGate(rg);
		if (!params.id || !isOid(params.id)) return fail(400, { error: '잘못된 ID입니다.' });
		let academyId;
		try {
			({ academyId } = await withAcademyScope());
		} catch {
			return fail(503, { error: 'DB에 연결할 수 없습니다.' });
		}
		const data = await request.formData();
		const parentUserId = data.get('parentUserId')?.toString()?.trim() ?? '';
		if (!USER_ID_RE.test(parentUserId)) {
			return fail(400, { error: '학부모 사용자 ID 형식이 올바르지 않습니다.' });
		}
		const parentMem = await AcademyMembership.findOne({
			academyId,
			userId: parentUserId,
			role: 'parent'
		}).lean();
		if (!parentMem) {
			return fail(400, { error: '이 학원의 학부모(parent) 멤버십이 아닙니다.' });
		}
		const studentExists = await Student.exists({ _id: params.id, academyId });
		if (!studentExists) return fail(404, { error: '학생을 찾을 수 없습니다.' });
		try {
			await ParentStudentLink.create({
				academyId,
				parentUserId,
				studentId: params.id
			});
		} catch (e: unknown) {
			if (e && typeof e === 'object' && 'code' in e && e.code === 11000) {
				return fail(400, { error: '이미 연결된 학부모입니다.' });
			}
			throw e;
		}
		redirect(303, `/students/${params.id}/edit`);
	},

	unlinkParent: async ({ request, params, locals }) => {
		const rg = gateDirectoryAction(locals);
		if (!rg.ok) return failFromGate(rg);
		if (!params.id || !isOid(params.id)) return fail(400, { error: '잘못된 ID입니다.' });
		let academyId;
		try {
			({ academyId } = await withAcademyScope());
		} catch {
			return fail(503, { error: 'DB에 연결할 수 없습니다.' });
		}
		const data = await request.formData();
		const parentUserId = data.get('parentUserId')?.toString()?.trim() ?? '';
		if (!USER_ID_RE.test(parentUserId)) {
			return fail(400, { error: '학부모 사용자 ID 형식이 올바르지 않습니다.' });
		}
		const del = await ParentStudentLink.deleteOne({
			academyId,
			parentUserId,
			studentId: params.id
		});
		if (del.deletedCount === 0) {
			return fail(404, { error: '연결을 찾을 수 없습니다.' });
		}
		redirect(303, `/students/${params.id}/edit`);
	}
};
