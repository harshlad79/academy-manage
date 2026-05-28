import nodemailer from 'nodemailer';
import type { Transporter } from 'nodemailer';
import type { Types } from 'mongoose';

import { academyBlocksExternalComms } from '$lib/server/academy-trial';
import { formatSeoulDateString } from '$lib/server/date-seoul';
import connectDB from '$lib/server/db';
import { Academy, type AcademyStatus } from '$lib/server/models/academy';
import type { AcademyInviteRole } from '$lib/server/models/academy-invite';

export type InviteMailPayload = {
	to: string;
	academyName: string;
	role: AcademyInviteRole;
	acceptUrl: string;
	expiresAt: Date;
};

export type InviteMailResult =
	| { status: 'sent' }
	| { status: 'failed'; error: string }
	| { status: 'skipped'; reason: 'disabled' | 'unconfigured' | 'trial_blocked' };

export type InviteAcademyTrialGate = {
	status: AcademyStatus;
	trialEndsAt?: Date | null;
};

export type LoadAcademyTrialGate = (academyId: Types.ObjectId) => Promise<InviteAcademyTrialGate | null>;

export type InviteMailEnv = {
	INVITE_MAIL_ENABLED?: string;
	SMTP_HOST?: string;
	SMTP_PORT?: string;
	SMTP_SECURE?: string;
	SMTP_USER?: string;
	SMTP_PASS?: string;
	INVITE_MAIL_FROM?: string;
	INVITE_MAIL_FROM_NAME?: string;
	PUBLIC_APP_ORIGIN?: string;
	BETTER_AUTH_URL?: string;
};

const ROLE_LABEL_KO: Record<AcademyInviteRole, string> = {
	academy_admin: '학원 관리자',
	office: '행정',
	teacher: '강사',
	parent: '학부모'
};

const MAX_ERROR_LEN = 500;

function envTrim(env: InviteMailEnv, key: keyof InviteMailEnv): string {
	return env[key]?.toString().trim() ?? '';
}

export function shouldSendInviteEmail(env: InviteMailEnv = process.env as InviteMailEnv): boolean {
	if (envTrim(env, 'INVITE_MAIL_ENABLED') !== 'true') return false;
	return (
		envTrim(env, 'SMTP_USER').length > 0 &&
		envTrim(env, 'SMTP_PASS').length > 0 &&
		envTrim(env, 'INVITE_MAIL_FROM').length > 0
	);
}

/** 수락 링크 베이스 URL (끝 슬래시 제거). */
export function resolveInviteMailOrigin(env: InviteMailEnv, requestOrigin: string): string {
	const fromEnv = envTrim(env, 'PUBLIC_APP_ORIGIN') || envTrim(env, 'BETTER_AUTH_URL');
	const base = (fromEnv || requestOrigin).replace(/\/$/, '');
	return base;
}

export function buildInviteAcceptUrl(originBase: string, token: string): string {
	return `${originBase}/invite/accept?token=${encodeURIComponent(token)}`;
}

export function truncateInviteMailError(message: string): string {
	const s = message.trim();
	if (s.length <= MAX_ERROR_LEN) return s;
	return `${s.slice(0, MAX_ERROR_LEN - 1)}…`;
}

export function inviteMailNoticeMessage(notice: string | null): string | null {
	switch (notice) {
		case 'invite_mail_sent':
			return '초대를 생성했고 메일을 발송했습니다.';
		case 'invite_mail_failed':
			return '초대는 생성됐으나 메일 발송에 실패했습니다. 아래 링크를 복사하거나 재발송하세요.';
		case 'invite_mail_skipped':
			return '초대를 생성했습니다. (메일 미발송 — INVITE_MAIL_ENABLED 및 SMTP 설정을 확인하세요.)';
		case 'invite_mail_trial_blocked':
			return '초대를 생성했습니다. (체험(trial) 기간에는 외부 메일 발송이 차단됩니다. 아래 수락 링크를 복사하세요.)';
		case 'invite_resent_ok':
			return '초대 메일을 다시 발송했습니다.';
		case 'invite_resent_failed':
			return '메일 재발송에 실패했습니다. 오류 열과 수락 링크를 확인하세요.';
		case 'invite_resent_trial_blocked':
			return '체험(trial) 기간에는 외부 메일 재발송이 차단됩니다. 수락 링크를 복사하세요.';
		default:
			return null;
	}
}

export async function defaultLoadAcademyTrialGate(
	academyId: Types.ObjectId
): Promise<InviteAcademyTrialGate | null> {
	await connectDB();
	const doc = await Academy.findById(academyId).select('status trialEndsAt').lean();
	if (!doc) return null;
	return { status: doc.status, trialEndsAt: doc.trialEndsAt };
}

export function inviteBlockedByTrialGate(gate: InviteAcademyTrialGate | null): boolean {
	if (!gate) return false;
	return academyBlocksExternalComms(gate.status, gate.trialEndsAt);
}

export async function academyInviteBlockedByTrial(
	academyId: Types.ObjectId | undefined,
	loadGate?: LoadAcademyTrialGate
): Promise<boolean> {
	if (!academyId) return false;
	const load = loadGate ?? defaultLoadAcademyTrialGate;
	const gate = await load(academyId);
	return inviteBlockedByTrialGate(gate);
}

function buildMailContent(payload: InviteMailPayload, fromName: string, fromAddress: string) {
	const roleLabel = ROLE_LABEL_KO[payload.role] ?? payload.role;
	const expiresStr = formatSeoulDateString(payload.expiresAt);
	const subject = `[${payload.academyName}] 학원 멤버십 초대`;
	const text = [
		`${payload.academyName}에서 학원 멤버십 초대가 도착했습니다.`,
		'',
		`부여 예정 역할: ${roleLabel}`,
		`만료일(서울 기준): ${expiresStr}`,
		'',
		'아래 링크에서 로그인한 뒤, 초대에 적힌 이메일과 동일한 계정으로 수락하세요.',
		'',
		payload.acceptUrl,
		'',
		'본 메일에 대해 문의가 있으면 학원 관리자에게 연락하세요.'
	].join('\n');
	const html = [
		`<p><strong>${escapeHtml(payload.academyName)}</strong>에서 학원 멤버십 초대가 도착했습니다.</p>`,
		`<p>부여 예정 역할: <strong>${escapeHtml(roleLabel)}</strong><br/>`,
		`만료일(서울 기준): ${escapeHtml(expiresStr)}</p>`,
		`<p>아래 버튼 또는 링크에서 로그인한 뒤, 초대 이메일과 <strong>동일한 계정</strong>으로 수락하세요.</p>`,
		`<p><a href="${escapeHtml(payload.acceptUrl)}">${escapeHtml(payload.acceptUrl)}</a></p>`
	].join('\n');
	return {
		from: fromName ? `"${fromName}" <${fromAddress}>` : fromAddress,
		to: payload.to,
		subject,
		text,
		html
	};
}

function escapeHtml(s: string): string {
	return s
		.replace(/&/g, '&amp;')
		.replace(/</g, '&lt;')
		.replace(/>/g, '&gt;')
		.replace(/"/g, '&quot;');
}

export type InviteMailSendFn = (options: {
	from: string;
	to: string;
	subject: string;
	text: string;
	html: string;
}) => Promise<void>;

function createTransportFromEnv(env: InviteMailEnv): Transporter {
	const host = envTrim(env, 'SMTP_HOST') || 'smtp.naver.com';
	const port = Number(envTrim(env, 'SMTP_PORT') || '465');
	const secure = envTrim(env, 'SMTP_SECURE') === 'false' ? false : port === 465 || port === 587;
	return nodemailer.createTransport({
		host,
		port,
		secure,
		auth: {
			user: envTrim(env, 'SMTP_USER'),
			pass: envTrim(env, 'SMTP_PASS')
		}
	});
}

/**
 * 초대 메일 발송. `INVITE_MAIL_ENABLED` 및 SMTP env가 없으면 skipped.
 * 테스트 시 `sendMail` 주입.
 */
export async function sendAcademyInviteEmail(
	payload: InviteMailPayload,
	options?: {
		env?: InviteMailEnv;
		sendMail?: InviteMailSendFn;
		academyId?: Types.ObjectId;
		loadAcademyTrialGate?: LoadAcademyTrialGate;
	}
): Promise<InviteMailResult> {
	if (await academyInviteBlockedByTrial(options?.academyId, options?.loadAcademyTrialGate)) {
		return { status: 'skipped', reason: 'trial_blocked' };
	}
	const env = options?.env ?? (process.env as InviteMailEnv);
	if (!shouldSendInviteEmail(env)) {
		const reason = envTrim(env, 'INVITE_MAIL_ENABLED') !== 'true' ? 'disabled' : 'unconfigured';
		return { status: 'skipped', reason };
	}
	const fromAddress = envTrim(env, 'INVITE_MAIL_FROM');
	const fromName = envTrim(env, 'INVITE_MAIL_FROM_NAME') || '학원 관리';
	const content = buildMailContent(payload, fromName, fromAddress);
	try {
		if (options?.sendMail) {
			await options.sendMail(content);
		} else {
			const transport = createTransportFromEnv(env);
			await transport.sendMail(content);
		}
		return { status: 'sent' };
	} catch (e) {
		const message = e instanceof Error ? e.message : String(e);
		return { status: 'failed', error: truncateInviteMailError(message) };
	}
}

export function inviteMailResultNotice(
	result: InviteMailResult,
	kind: 'create' | 'resend'
): string {
	if (result.status === 'sent') {
		return kind === 'create' ? 'invite_mail_sent' : 'invite_resent_ok';
	}
	if (result.status === 'skipped') {
		if (result.reason === 'trial_blocked') {
			return kind === 'create' ? 'invite_mail_trial_blocked' : 'invite_resent_trial_blocked';
		}
		return 'invite_mail_skipped';
	}
	return kind === 'create' ? 'invite_mail_failed' : 'invite_resent_failed';
}
