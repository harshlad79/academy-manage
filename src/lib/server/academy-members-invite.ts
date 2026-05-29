import { error, fail, redirect } from '@sveltejs/kit';
import { Types } from 'mongoose';
import { isOidHex } from '$lib/server/active-academy';
import connectDB from '$lib/server/db';
import { Academy } from '$lib/server/models/academy';
import {
	AcademyInvite,
	defaultInviteExpiresAt,
	generateInviteToken,
	validateInviteChannelFields
} from '$lib/server/models/academy-invite';
import { AcademyMembership } from '$lib/server/models/academy-membership';
import { Teacher } from '$lib/server/models/teacher';
import { applyInviteEmailMeta } from '$lib/server/invite-email-meta';
import {
	buildInviteAcceptUrl,
	type InviteMailEnv,
	inviteMailNoticeMessage,
	inviteMailResultNotice,
	resolveInviteMailOrigin,
	sendAcademyInviteEmail
} from '$lib/server/invite-mail';
import { dispatchInviteSms, inviteSmsNoticeMessage } from '$lib/server/invite-sms';
import {
	assertTeacherLinkValid,
	TEACHER_INVITE_PENDING_USER_ID
} from '$lib/server/teacher-membership-link';
import { ACADEMY_ROLES, type AcademyRole } from '$lib/server/rbac';

export type InviteRole = Exclude<AcademyRole, 'super_admin'>;

export const INVITE_ROLES: InviteRole[] = ACADEMY_ROLES.filter(
	(r): r is InviteRole => r !== 'super_admin'
);

export function parseAcademyIdParam(academyIdParam: string | undefined): Types.ObjectId | null {
	const raw = academyIdParam?.trim() ?? '';
	if (!isOidHex(raw)) return null;
	return new Types.ObjectId(raw);
}

export function membersRedirect(redirectPath: string, notice: string): never {
	redirect(303, `${redirectPath}?notice=${encodeURIComponent(notice)}`);
}

async function dispatchInviteEmail(
	academyId: Types.ObjectId,
	inviteId: Types.ObjectId,
	academyName: string,
	email: string,
	role: InviteRole,
	token: string,
	expiresAt: Date,
	requestOrigin: string,
	kind: 'create' | 'resend'
): Promise<string> {
	const mailEnv = process.env as InviteMailEnv;
	const originBase = resolveInviteMailOrigin(mailEnv, requestOrigin);
	const acceptUrl = buildInviteAcceptUrl(originBase, token);
	const mailResult = await sendAcademyInviteEmail(
		{
			to: email,
			academyName,
			role,
			acceptUrl,
			expiresAt
		},
		{ academyId }
	);
	await applyInviteEmailMeta(inviteId, mailResult);
	return inviteMailResultNotice(mailResult, kind);
}

export async function loadMembersPageData(academyId: Types.ObjectId, url: URL) {
	await connectDB();
	const [academy, members, teacherDocs, inviteDocs] = await Promise.all([
		Academy.findById(academyId).lean(),
		AcademyMembership.find({ academyId }).sort({ role: 1, userId: 1 }).lean(),
		Teacher.find({ academyId }).sort({ name: 1 }).select('name subject').lean(),
		AcademyInvite.find({ academyId }).sort({ createdAt: -1 }).lean()
	]);
	if (!academy) {
		return error(404, '학원을 찾을 수 없습니다.');
	}
	const teacherNameById = new Map(teacherDocs.map((t) => [t._id.toString(), t.name]));
	const notice = url.searchParams.get('notice');
	return {
		inviteAcceptOrigin: resolveInviteMailOrigin(process.env as InviteMailEnv, url.origin),
		notice,
		noticeMessage: inviteMailNoticeMessage(notice) ?? inviteSmsNoticeMessage(notice),
		academyIdHex: academyId.toHexString(),
		academyName: academy.name,
		academyStatus: academy.status,
		inviteRoles: INVITE_ROLES,
		teacherOptions: teacherDocs.map((t) => ({
			id: t._id.toString(),
			name: t.name,
			subject: t.subject ?? null
		})),
		inviteRows: inviteDocs.map((inv) => ({
			id: inv._id.toString(),
			channel: inv.role === 'parent' || inv.phone ? ('sms' as const) : ('email' as const),
			email: inv.email ?? null,
			phone: inv.phone ?? null,
			role: inv.role as InviteRole,
			expiresAt: inv.expiresAt.toISOString(),
			token: inv.token,
			linkedTeacherId: inv.linkedTeacherId?.toString() ?? null,
			linkedTeacherName: inv.linkedTeacherId
				? (teacherNameById.get(inv.linkedTeacherId.toString()) ?? null)
				: null,
			lastEmailSentAt: inv.lastEmailSentAt?.toISOString() ?? null,
			lastEmailError: inv.lastEmailError ?? null,
			lastSmsSentAt: inv.lastSmsSentAt?.toISOString() ?? null,
			lastSmsError: inv.lastSmsError ?? null
		})),
		rows: members.map((m) => ({
			userId: m.userId,
			role: m.role as AcademyRole,
			linkedTeacherId: m.linkedTeacherId?.toString() ?? null,
			linkedTeacherName: m.linkedTeacherId
				? (teacherNameById.get(m.linkedTeacherId.toString()) ?? null)
				: null
		}))
	};
}

export async function createAcademyInvite(options: {
	academyId: Types.ObjectId;
	localsUserId?: string;
	formData: FormData;
	urlOrigin: string;
	redirectPath: string;
}) {
	const { academyId, localsUserId, formData, urlOrigin, redirectPath } = options;
	const roleRaw = formData.get('role')?.toString()?.trim() ?? '';
	if (!INVITE_ROLES.includes(roleRaw as InviteRole)) {
		return fail(400, { error: '허용되지 않은 역할입니다.' });
	}
	const channel = validateInviteChannelFields(
		roleRaw as InviteRole,
		formData.get('email')?.toString() ?? '',
		formData.get('phone')?.toString() ?? ''
	);
	if (!channel.ok) return fail(400, { error: channel.error });
	await connectDB();
	let linkedTeacherId: Types.ObjectId | undefined;
	if (roleRaw === 'teacher') {
		const ltRaw = formData.get('linkedTeacherId')?.toString()?.trim() ?? '';
		if (ltRaw && isOidHex(ltRaw)) {
			const tid = new Types.ObjectId(ltRaw);
			const chk = await assertTeacherLinkValid(academyId, tid, TEACHER_INVITE_PENDING_USER_ID);
			if (!chk.ok) return fail(400, { error: chk.error });
			linkedTeacherId = tid;
		}
	}
	const token = generateInviteToken();
	const expiresAt = defaultInviteExpiresAt();
	const academy = await Academy.findById(academyId).lean();
	const academyName = academy?.name ?? '학원';
	if ('phone' in channel.fields && channel.fields.phone) {
		const phone = channel.fields.phone;
		await AcademyInvite.deleteMany({ academyId, phone });
		const created = await AcademyInvite.create({
			academyId,
			phone,
			role: roleRaw as InviteRole,
			token,
			expiresAt,
			...(localsUserId ? { createdByUserId: localsUserId } : {}),
			...(linkedTeacherId ? { linkedTeacherId } : {})
		});
		const notice = await dispatchInviteSms(
			created._id,
			academyName,
			phone,
			token,
			expiresAt,
			urlOrigin,
			'create',
			academyId
		);
		membersRedirect(redirectPath, notice);
	}
	if (!('email' in channel.fields) || !channel.fields.email) {
		return fail(400, { error: '초대 채널을 확인할 수 없습니다.' });
	}
	const email = channel.fields.email;
	await AcademyInvite.deleteMany({ academyId, email });
	const created = await AcademyInvite.create({
		academyId,
		email,
		role: roleRaw as InviteRole,
		token,
		expiresAt,
		...(localsUserId ? { createdByUserId: localsUserId } : {}),
		...(linkedTeacherId ? { linkedTeacherId } : {})
	});
	const notice = await dispatchInviteEmail(
		academyId,
		created._id,
		academyName,
		email,
		roleRaw as InviteRole,
		token,
		expiresAt,
		urlOrigin,
		'create'
	);
	membersRedirect(redirectPath, notice);
}

export async function resendAcademyInvite(options: {
	academyId: Types.ObjectId;
	formData: FormData;
	urlOrigin: string;
	redirectPath: string;
}) {
	const { academyId, formData, urlOrigin, redirectPath } = options;
	const idRaw = formData.get('inviteId')?.toString()?.trim() ?? '';
	if (!isOidHex(idRaw)) {
		return fail(400, { error: '잘못된 초대 ID입니다.' });
	}
	await connectDB();
	const oid = new Types.ObjectId(idRaw);
	const inv = await AcademyInvite.findOne({ _id: oid, academyId }).lean();
	if (!inv) {
		return fail(404, { error: '초대를 찾을 수 없습니다.' });
	}
	if (inv.expiresAt.getTime() < Date.now()) {
		return fail(400, {
			error: '만료된 초대에는 재발송할 수 없습니다. 새 초대를 만드세요.'
		});
	}
	const academy = await Academy.findById(academyId).lean();
	if (!academy) {
		return fail(404, { error: '학원을 찾을 수 없습니다.' });
	}
	if (inv.role === 'parent' || inv.phone) {
		if (!inv.phone) {
			return fail(400, { error: 'SMS 초대에 전화번호가 없습니다.' });
		}
		const notice = await dispatchInviteSms(
			oid,
			academy.name,
			inv.phone,
			inv.token,
			inv.expiresAt,
			urlOrigin,
			'resend',
			academyId
		);
		membersRedirect(redirectPath, notice);
	}
	if (!inv.email) {
		return fail(400, { error: '이메일 초대에 주소가 없습니다.' });
	}
	const notice = await dispatchInviteEmail(
		academyId,
		oid,
		academy.name,
		inv.email,
		inv.role as InviteRole,
		inv.token,
		inv.expiresAt,
		urlOrigin,
		'resend'
	);
	membersRedirect(redirectPath, notice);
}

