import { error, fail, redirect } from '@sveltejs/kit';
import { Types } from 'mongoose';
import { isOidHex } from '$lib/server/active-academy';
import { isMockAuthMode, liveBetterAuthUserExists } from '$lib/server/auth';
import connectDB from '$lib/server/db';
import { Academy } from '$lib/server/models/academy';
import {
	AcademyInvite,
	defaultInviteExpiresAt,
	generateInviteToken,
	normalizeInviteEmail
} from '$lib/server/models/academy-invite';
import { AcademyMembership } from '$lib/server/models/academy-membership';
import { Teacher } from '$lib/server/models/teacher';
import {
	assertTeacherLinkValid,
	TEACHER_INVITE_PENDING_USER_ID
} from '$lib/server/teacher-membership-link';
import { ACADEMY_ROLES, ensurePlatformSuperAdmin, type AcademyRole } from '$lib/server/rbac';
import type { Actions, PageServerLoad } from './$types';

type InviteRole = Exclude<AcademyRole, 'super_admin'>;
const INVITE_ROLES: InviteRole[] = ACADEMY_ROLES.filter(
	(r): r is InviteRole => r !== 'super_admin'
);

function parseAcademyIdParam(academyIdParam: string | undefined): Types.ObjectId | null {
	const raw = academyIdParam?.trim() ?? '';
	if (!isOidHex(raw)) return null;
	return new Types.ObjectId(raw);
}

export const load: PageServerLoad = async ({ params, locals, url }) => {
	ensurePlatformSuperAdmin(locals);
	const academyId = parseAcademyIdParam(params.academyId);
	if (!academyId) error(404, '학원을 찾을 수 없습니다.');
	await connectDB();
	const [academy, members, teacherDocs, inviteDocs] = await Promise.all([
		Academy.findById(academyId).lean(),
		AcademyMembership.find({ academyId }).sort({ role: 1, userId: 1 }).lean(),
		Teacher.find({ academyId }).sort({ name: 1 }).select('name subject').lean(),
		AcademyInvite.find({ academyId }).sort({ createdAt: -1 }).lean()
	]);
	if (!academy) error(404, '학원을 찾을 수 없습니다.');
	const teacherNameById = new Map(teacherDocs.map((t) => [t._id.toString(), t.name]));
	return {
		inviteAcceptOrigin: url.origin,
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
			email: inv.email,
			role: inv.role as InviteRole,
			expiresAt: inv.expiresAt.toISOString(),
			token: inv.token,
			linkedTeacherId: inv.linkedTeacherId?.toString() ?? null,
			linkedTeacherName: inv.linkedTeacherId
				? (teacherNameById.get(inv.linkedTeacherId.toString()) ?? null)
				: null
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
};

export const actions: Actions = {
	addMember: async ({ request, locals, params }) => {
		ensurePlatformSuperAdmin(locals);
		const academyId = parseAcademyIdParam(params.academyId);
		if (!academyId) return fail(400, { error: '잘못된 학원 ID입니다.' });
		const fd = await request.formData();
		const userId = fd.get('userId')?.toString()?.trim() ?? '';
		const roleRaw = fd.get('role')?.toString()?.trim() ?? '';
		if (!userId || userId.length > 128) {
			return fail(400, { error: 'Better Auth 사용자 ID(128자 이내)를 입력하세요.' });
		}
		if (!isMockAuthMode()) {
			const exists = await liveBetterAuthUserExists(userId);
			if (!exists) {
				return fail(400, {
					error: 'Better Auth에 등록된 사용자 ID가 아닙니다. 먼저 계정을 생성하세요.'
				});
			}
		}
		if (!INVITE_ROLES.includes(roleRaw as InviteRole)) {
			return fail(400, { error: '허용되지 않은 역할입니다.' });
		}
		await connectDB();
		const dup = await AcademyMembership.exists({ userId, academyId });
		if (dup) {
			return fail(400, { error: '이미 이 학원에 대한 멤버십이 있습니다.' });
		}
		let linkedTeacherId: Types.ObjectId | undefined;
		if (roleRaw === 'teacher') {
			const ltRaw = fd.get('linkedTeacherId')?.toString()?.trim() ?? '';
			if (ltRaw && isOidHex(ltRaw)) {
				const tid = new Types.ObjectId(ltRaw);
				const chk = await assertTeacherLinkValid(academyId, tid, userId);
				if (!chk.ok) return fail(400, { error: chk.error });
				linkedTeacherId = tid;
			}
		}
		await AcademyMembership.create({
			userId,
			academyId,
			role: roleRaw as InviteRole,
			...(linkedTeacherId ? { linkedTeacherId } : {})
		});
		redirect(303, `/platform/academies/${academyId.toHexString()}/members`);
	},
	updateLinkedTeacher: async ({ request, locals, params }) => {
		ensurePlatformSuperAdmin(locals);
		const academyId = parseAcademyIdParam(params.academyId);
		if (!academyId) return fail(400, { error: '잘못된 학원 ID입니다.' });
		const fd = await request.formData();
		const userId = fd.get('userId')?.toString()?.trim() ?? '';
		if (!userId) {
			return fail(400, { error: '사용자 ID가 필요합니다.' });
		}
		const ltRaw = fd.get('linkedTeacherId')?.toString()?.trim() ?? '';
		await connectDB();
		const mem = await AcademyMembership.findOne({ userId, academyId }).lean();
		if (!mem) {
			return fail(404, { error: '멤버십을 찾을 수 없습니다.' });
		}
		if ((mem.role as AcademyRole) !== 'teacher') {
			return fail(400, { error: '강사(teacher) 멤버십만 강사 프로필을 연결할 수 있습니다.' });
		}
		if (!ltRaw) {
			await AcademyMembership.updateOne({ userId, academyId }, { $unset: { linkedTeacherId: 1 } });
			redirect(303, `/platform/academies/${academyId.toHexString()}/members`);
		}
		if (!isOidHex(ltRaw)) {
			return fail(400, { error: '강사 ID 형식이 올바르지 않습니다.' });
		}
		const tid = new Types.ObjectId(ltRaw);
		const chk = await assertTeacherLinkValid(academyId, tid, userId);
		if (!chk.ok) return fail(400, { error: chk.error });
		await AcademyMembership.updateOne({ userId, academyId }, { $set: { linkedTeacherId: tid } });
		redirect(303, `/platform/academies/${academyId.toHexString()}/members`);
	},
	removeMember: async ({ request, locals, params }) => {
		ensurePlatformSuperAdmin(locals);
		const academyId = parseAcademyIdParam(params.academyId);
		if (!academyId) return fail(400, { error: '잘못된 학원 ID입니다.' });
		const fd = await request.formData();
		const userId = fd.get('userId')?.toString()?.trim() ?? '';
		const roleRaw = fd.get('role')?.toString()?.trim() ?? '';
		if (!userId || !roleRaw) {
			return fail(400, { error: '삭제 대상이 올바르지 않습니다.' });
		}
		await connectDB();
		if (roleRaw === 'super_admin') {
			const n = await AcademyMembership.countDocuments({ academyId, role: 'super_admin' });
			if (n <= 1) {
				return fail(400, {
					error: '이 학원의 마지막 전체관리자(super_admin) 멤버십은 삭제할 수 없습니다.'
				});
			}
		}
		const del = await AcademyMembership.deleteOne({ userId, academyId });
		if (del.deletedCount === 0) {
			return fail(404, { error: '멤버십을 찾을 수 없습니다.' });
		}
		redirect(303, `/platform/academies/${academyId.toHexString()}/members`);
	},
	createInvite: async ({ request, locals, params }) => {
		ensurePlatformSuperAdmin(locals);
		const academyId = parseAcademyIdParam(params.academyId);
		if (!academyId) return fail(400, { error: '잘못된 학원 ID입니다.' });
		const fd = await request.formData();
		const email = normalizeInviteEmail(fd.get('email')?.toString() ?? '');
		if (!email) {
			return fail(400, { error: '유효한 이메일 주소를 입력하세요.' });
		}
		const roleRaw = fd.get('role')?.toString()?.trim() ?? '';
		if (!INVITE_ROLES.includes(roleRaw as InviteRole)) {
			return fail(400, { error: '허용되지 않은 역할입니다.' });
		}
		await connectDB();
		let linkedTeacherId: Types.ObjectId | undefined;
		if (roleRaw === 'teacher') {
			const ltRaw = fd.get('linkedTeacherId')?.toString()?.trim() ?? '';
			if (ltRaw && isOidHex(ltRaw)) {
				const tid = new Types.ObjectId(ltRaw);
				const chk = await assertTeacherLinkValid(academyId, tid, TEACHER_INVITE_PENDING_USER_ID);
				if (!chk.ok) return fail(400, { error: chk.error });
				linkedTeacherId = tid;
			}
		}
		await AcademyInvite.deleteMany({ academyId, email });
		await AcademyInvite.create({
			academyId,
			email,
			role: roleRaw as InviteRole,
			token: generateInviteToken(),
			expiresAt: defaultInviteExpiresAt(),
			...(locals.user?.id ? { createdByUserId: locals.user.id } : {}),
			...(linkedTeacherId ? { linkedTeacherId } : {})
		});
		redirect(303, `/platform/academies/${academyId.toHexString()}/members`);
	},
	revokeInvite: async ({ request, locals, params }) => {
		ensurePlatformSuperAdmin(locals);
		const academyId = parseAcademyIdParam(params.academyId);
		if (!academyId) return fail(400, { error: '잘못된 학원 ID입니다.' });
		const fd = await request.formData();
		const idRaw = fd.get('inviteId')?.toString()?.trim() ?? '';
		if (!isOidHex(idRaw)) {
			return fail(400, { error: '잘못된 초대 ID입니다.' });
		}
		await connectDB();
		const oid = new Types.ObjectId(idRaw);
		const del = await AcademyInvite.deleteOne({ _id: oid, academyId });
		if (del.deletedCount === 0) {
			return fail(404, { error: '초대를 찾을 수 없습니다.' });
		}
		redirect(303, `/platform/academies/${academyId.toHexString()}/members`);
	}
};
