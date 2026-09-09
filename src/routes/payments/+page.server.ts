import { fail, redirect } from '@sveltejs/kit';
import { withAcademyScope } from '$lib/server/academy-scope';
import {
	formatSeoulDateString,
	formatSeoulYearMonth,
	isYmdSeoulCalendarDate,
	seoulMonthRange
} from '$lib/server/date-seoul';
import {
	fetchOpenBankingStubTransactions,
	isOpenBankingConfigured,
	type OpenBankingTransaction
} from '$lib/server/banking/open-banking-stub';
import { BankDeposit } from '$lib/server/models/bank-deposit';
import { Academy } from '$lib/server/models/academy';
import {
	suggestDepositMatches,
	type DepositMatchSuggestion
} from '$lib/server/banking/deposit-matching';
import { Enrollment } from '$lib/server/models/enrollment';
import { InvoiceLine, type InvoiceLineStatus } from '$lib/server/models/invoice-line';
import { Payment, type PaymentMethod } from '$lib/server/models/payment';
import { isPopulatedIdName } from '$lib/server/mongo-populate-guards';
import {
	loadPaymentDueNotifyInput,
	notifyParentsPaymentDueEmail,
	notifyParentsPaymentDuePush,
	notifyParentsPaymentDueSms,
	type ParentPaymentNotifyOutcome,
	type PaymentDueNotifyInput
} from '$lib/server/parent-payment-notify';
import { shouldSendParentNotifyEmail } from '$lib/server/parent-notify-email';
import { parentNotifyNoticeMessage } from '$lib/server/parent-notify-notices';
import { shouldSendParentNotifyPush } from '$lib/server/parent-notify-push';
import { shouldSendParentNotifySms } from '$lib/server/parent-notify-sms';
import { ensureFinanceAccess, failFromGate, gateFinanceAction } from '$lib/server/rbac';
import mongoose, { type Types } from 'mongoose';
import type { Actions, PageServerLoad } from './$types';

function paymentsRedirect(notice?: string): never {
	const q = notice ? `?notice=${encodeURIComponent(notice)}` : '';
	redirect(303, `/payments${q}`);
}

function isOid(id: string) {
	return /^[a-f\d]{24}$/i.test(id);
}

const RECENT_PAYMENTS_LIMIT = 30;
const PENDING_DEPOSITS_LIMIT = 50;
const MAX_MEMO = 200;
const MAX_EXT_REF = 128;

export type OpenBankingPreviewRow = {
	externalId: string;
	amountKrw: number;
	depositedAt: string;
	memo: string | null;
};

export type OpenBankingPreview = {
	enabled: boolean;
	configured: boolean;
	monthLabel: string;
	rows: OpenBankingPreviewRow[];
};

export type PaymentsInvoiceRow = {
	id: string;
	enrollmentId: string;
	studentName: string;
	courseName: string;
	amountKrw: number;
	description: string;
	dueDate: string;
	status: InvoiceLineStatus;
	paidAt: string | null;
};

async function invoiceLinesEnrichedRows(
	academyId: Types.ObjectId,
	status?: InvoiceLineStatus
): Promise<PaymentsInvoiceRow[]> {
	const lineQuery: Record<string, unknown> = { academyId };
	if (status) lineQuery.status = status;
	const lines = await InvoiceLine.find(lineQuery).sort({ dueDate: 1, createdAt: -1 }).lean();
	const eids = [...new Set(lines.map((l) => l.enrollmentId.toString()))];
	const enrs =
		eids.length > 0
			? await Enrollment.find({ _id: { $in: eids }, academyId })
					.populate('studentId')
					.populate('courseId')
					.lean()
			: [];
	const enrMap = new Map(enrs.map((e) => [e._id.toString(), e]));

	return lines.map((line) => {
		const en = enrMap.get(line.enrollmentId.toString());
		const st = en && isPopulatedIdName(en.studentId) ? en.studentId : null;
		const co = en && isPopulatedIdName(en.courseId) ? en.courseId : null;
		return {
			id: line._id.toString(),
			enrollmentId: line.enrollmentId.toString(),
			studentName: st?.name ?? '—',
			courseName: co?.name ?? '—',
			amountKrw: line.amountKrw,
			description: line.description,
			dueDate: line.dueDate,
			status: line.status,
			paidAt: line.paidAt ? line.paidAt.toISOString() : null
		};
	});
}

/** `Payment` 조회 후 `populate`된 `invoiceLineId` 트리에서 학생·클래스 라벨 */
function labelsFromInvoiceLinePop(raw: unknown): {
	studentName: string;
	courseName: string;
	description: string;
} {
	if (typeof raw !== 'object' || raw === null) {
		return { studentName: '—', courseName: '—', description: '—' };
	}
	const line = raw as { description?: unknown; enrollmentId?: unknown };
	const description =
		typeof line.description === 'string' && line.description ? line.description : '—';
	const en = line.enrollmentId;
	if (typeof en !== 'object' || en === null) {
		return { studentName: '—', courseName: '—', description };
	}
	const e = en as { studentId?: unknown; courseId?: unknown };
	const st = isPopulatedIdName(e.studentId) ? e.studentId : null;
	const co = isPopulatedIdName(e.courseId) ? e.courseId : null;
	return {
		studentName: st?.name ?? '—',
		courseName: co?.name ?? '—',
		description
	};
}

const MAX_DESC = 500;
const MAX_AMOUNT = 1_000_000_000;

/** Same window as load: current Seoul calendar month. */
function stubTransactionsForPreviewMonth(): OpenBankingTransaction[] {
	const month = formatSeoulYearMonth();
	const range = seoulMonthRange(month);
	if (!range) return [];
	const toInclusive = new Date(range.endExclusive.getTime() - 1);
	return fetchOpenBankingStubTransactions({
		from: range.start,
		to: toInclusive
	});
}

const STUB_DEPOSITED_AT_TOLERANCE_MS = 1000;

function findMatchingStubTransaction(
	stubs: OpenBankingTransaction[],
	externalIdTrimmed: string,
	amountKrw: number,
	depositedAtMs: number
): OpenBankingTransaction | undefined {
	return stubs.find(
		(t) =>
			t.externalId === externalIdTrimmed &&
			t.amountKrw === amountKrw &&
			Math.abs(t.depositedAt.getTime() - depositedAtMs) <= STUB_DEPOSITED_AT_TOLERANCE_MS
	);
}

export const load: PageServerLoad = async ({ url, locals }) => {
	ensureFinanceAccess(locals);
	const statusFilter = url.searchParams.get('status')?.trim() ?? '';
	try {
		const { academyId } = await withAcademyScope();
		const academyDoc = await Academy.findById(academyId).select('billingAutoImport').lean();
		const billingAutoImport = academyDoc?.billingAutoImport === true;
		const enrollmentRows = await Enrollment.find({ academyId })
			.populate('studentId')
			.populate('courseId')
			.sort({ createdAt: 1 })
			.lean();
		const enrollments = enrollmentRows.map((row) => {
			const st = isPopulatedIdName(row.studentId) ? row.studentId : null;
			const co = isPopulatedIdName(row.courseId) ? row.courseId : null;
			const label =
				st && co ? `${st.name} · ${co.name}` : (st?.name ?? co?.name ?? row._id.toString());
			return { id: row._id.toString(), label };
		});

		const rowsStatus: InvoiceLineStatus | undefined =
			statusFilter === 'open' || statusFilter === 'paid' ? statusFilter : undefined;

		const rows = await invoiceLinesEnrichedRows(academyId, rowsStatus);
		const matchingLines = await invoiceLinesEnrichedRows(academyId, 'open');

		const pendingDepositRows = await BankDeposit.find({ academyId, status: 'unmatched' })
			.sort({ depositedAt: -1 })
			.limit(PENDING_DEPOSITS_LIMIT)
			.lean();

		const pendingDeposits = pendingDepositRows.map((d) => ({
			id: d._id.toString(),
			amountKrw: d.amountKrw,
			depositedAt: d.depositedAt.toISOString(),
			memo: d.memo ?? null,
			externalRef: d.externalRef ?? null
		}));

		const paymentRows = await Payment.find({ academyId })
			.sort({ paidAt: -1 })
			.limit(RECENT_PAYMENTS_LIMIT)
			.populate({
				path: 'invoiceLineId',
				populate: {
					path: 'enrollmentId',
					populate: [
						{ path: 'studentId', select: 'name' },
						{ path: 'courseId', select: 'name' }
					]
				}
			})
			.lean();

		const recentPayments = paymentRows.map((p) => {
			const lbl = labelsFromInvoiceLinePop(p.invoiceLineId);
			return {
				id: p._id.toString(),
				amountKrw: p.amountKrw,
				method: p.method,
				paidAt: p.paidAt.toISOString(),
				recordedByUserId: p.recordedByUserId,
				studentName: lbl.studentName,
				courseName: lbl.courseName,
				description: lbl.description,
				externalRef: p.externalRef ?? null
			};
		});

		const defaultMonth = formatSeoulYearMonth();
		const openBankingEnabled = process.env.OPEN_BANKING_ENABLED === 'true';
		const openBankingConfigured = isOpenBankingConfigured();
		let openBankingPreview: OpenBankingPreview = {
			enabled: openBankingEnabled,
			configured: openBankingConfigured,
			monthLabel: defaultMonth,
			rows: []
		};
		if (openBankingEnabled) {
			const stubRows = stubTransactionsForPreviewMonth();
			openBankingPreview = {
				enabled: true,
				configured: openBankingConfigured,
				monthLabel: defaultMonth,
				rows: stubRows.map((t) => ({
					externalId: t.externalId,
					amountKrw: t.amountKrw,
					depositedAt: t.depositedAt.toISOString(),
					memo: t.memo ?? null
				}))
			};
		}

		const notice = url.searchParams.get('notice');
		const autoMatchSuggestions: DepositMatchSuggestion[] = billingAutoImport
			? suggestDepositMatches(pendingDeposits, matchingLines)
			: [];
		return {
			rows,
			matchingLines,
			pendingDeposits,
			recentPayments,
			enrollments,
			statusFilter,
			defaultDueDate: formatSeoulDateString(),
			dbError: null as string | null,
			billingAutoImport,
			autoMatchSuggestions,
			openBankingPreview,
			notice,
			noticeMessage: parentNotifyNoticeMessage(notice),
			parentNotifySmsEnabled: shouldSendParentNotifySms(),
			parentNotifyEmailEnabled: shouldSendParentNotifyEmail(),
			parentNotifyPushEnabled: shouldSendParentNotifyPush()
		};
	} catch (e) {
		console.error('[payments load]', e);
		const defaultMonthCatch = formatSeoulYearMonth();
		return {
			rows: [] as PaymentsInvoiceRow[],
			matchingLines: [] as PaymentsInvoiceRow[],
			pendingDeposits: [] as {
				id: string;
				amountKrw: number;
				depositedAt: string;
				memo: string | null;
				externalRef: string | null;
			}[],
			recentPayments: [] as {
				id: string;
				amountKrw: number;
				method: PaymentMethod;
				paidAt: string;
				recordedByUserId: string;
				studentName: string;
				courseName: string;
				description: string;
				externalRef: string | null;
			}[],
			enrollments: [] as { id: string; label: string }[],
			statusFilter,
			defaultDueDate: formatSeoulDateString(),
			dbError: 'MongoDB에 연결할 수 없습니다. DB를 띄우고 시드한 뒤 다시 시도하세요.',
			billingAutoImport: false,
			autoMatchSuggestions: [] as DepositMatchSuggestion[],
			openBankingPreview: {
				enabled: process.env.OPEN_BANKING_ENABLED === 'true',
				configured: isOpenBankingConfigured(),
				monthLabel: defaultMonthCatch,
				rows: [] as OpenBankingPreviewRow[]
			} satisfies OpenBankingPreview,
			notice: url.searchParams.get('notice'),
			noticeMessage: parentNotifyNoticeMessage(url.searchParams.get('notice')),
			parentNotifySmsEnabled: shouldSendParentNotifySms(),
			parentNotifyEmailEnabled: shouldSendParentNotifyEmail(),
			parentNotifyPushEnabled: shouldSendParentNotifyPush()
		};
	}
};

async function runPaymentDueNotifyAction(
	request: Request,
	locals: App.Locals,
	notify: (input: PaymentDueNotifyInput) => Promise<ParentPaymentNotifyOutcome>
): Promise<{ notice: string } | { fail: ReturnType<typeof fail> }> {
	const rg = gateFinanceAction(locals);
	if (!rg.ok) return { fail: failFromGate(rg) };
	let academyId: Types.ObjectId;
	try {
		({ academyId } = await withAcademyScope());
	} catch {
		return { fail: fail(503, { error: 'DB에 연결할 수 없습니다.' }) };
	}
	const data = await request.formData();
	const id = String(data.get('id') ?? '');
	const loaded = await loadPaymentDueNotifyInput(academyId, id);
	if ('error' in loaded) {
		const code = loaded.error.includes('찾지') ? 404 : 400;
		return { fail: fail(code, { error: loaded.error }) };
	}
	const outcome = await notify(loaded.input);
	return { notice: outcome.notice };
}

function parseAmount(raw: string): { error: string } | { value: number } {
	const s = raw.trim().replace(/,/g, '');
	if (!s) return { error: '금액을 입력하세요.' };
	const n = Number(s);
	if (!Number.isFinite(n) || !Number.isInteger(n) || n < 1)
		return { error: '금액은 1원 이상의 정수로 입력하세요.' };
	if (n > MAX_AMOUNT) return { error: '금액이 너무 큽니다.' };
	return { value: n };
}

export const actions: Actions = {
	create: async ({ request, locals }) => {
		const rg = gateFinanceAction(locals);
		if (!rg.ok) return failFromGate(rg);
		let academyId;
		try {
			({ academyId } = await withAcademyScope());
		} catch {
			return fail(503, { error: 'DB에 연결할 수 없습니다.' });
		}
		const data = await request.formData();
		const enrollmentId = String(data.get('enrollmentId') ?? '');
		if (!isOid(enrollmentId)) return fail(400, { error: '수강을 선택하세요.' });
		const ens = await Enrollment.exists({ _id: enrollmentId, academyId });
		if (!ens) return fail(400, { error: '선택한 수강이 이 학원에 없습니다.' });
		const amount = parseAmount(String(data.get('amountKrw') ?? ''));
		if ('error' in amount) return fail(400, { error: amount.error });
		let description = String(data.get('description') ?? '').trim();
		if (!description) description = '수강료';
		if (description.length > MAX_DESC)
			return fail(400, { error: `설명은 ${MAX_DESC}자 이하로 입력하세요.` });
		const dueDate = String(data.get('dueDate') ?? '').trim();
		if (!isYmdSeoulCalendarDate(dueDate))
			return fail(400, { error: '납부기한 날짜가 올바르지 않습니다.' });

		await InvoiceLine.create({
			academyId,
			enrollmentId,
			amountKrw: amount.value,
			description,
			dueDate,
			status: 'open'
		});
		return { success: true as const };
	},

	markPaid: async ({ request, locals }) => {
		const rg = gateFinanceAction(locals);
		if (!rg.ok) return failFromGate(rg);
		const uid = locals.user?.id;
		if (!uid) return fail(401, { error: '로그인이 필요합니다.' });
		let academyId;
		try {
			({ academyId } = await withAcademyScope());
		} catch {
			return fail(503, { error: 'DB에 연결할 수 없습니다.' });
		}
		const data = await request.formData();
		const id = String(data.get('id') ?? '');
		if (!isOid(id)) return fail(400, { error: '잘못된 청구 ID입니다.' });
		const paidAt = new Date();
		const updated = await InvoiceLine.findOneAndUpdate(
			{ _id: id, academyId, status: 'open' },
			{ $set: { status: 'paid', paidAt } },
			{ new: true, lean: true }
		);
		if (!updated) {
			const exists = await InvoiceLine.exists({ _id: id, academyId });
			if (!exists) return fail(404, { error: '청구를 찾지 못했습니다.' });
			return fail(400, { error: '이미 처리된 청구입니다.' });
		}
		try {
			await Payment.create({
				academyId,
				invoiceLineId: updated._id,
				amountKrw: updated.amountKrw,
				method: 'manual',
				recordedByUserId: uid,
				paidAt
			});
		} catch (e) {
			console.error('[payments markPaid] Payment.create', e);
			await InvoiceLine.updateOne(
				{ _id: id, academyId },
				{ $set: { status: 'open' }, $unset: { paidAt: 1 } }
			);
			return fail(500, { error: '수납 기록 저장에 실패했습니다. 다시 시도하세요.' });
		}
		return { success: true as const };
	},

	notifyPaymentDue: async ({ request, locals }) => {
		const outcome = await runPaymentDueNotifyAction(request, locals, notifyParentsPaymentDueSms);
		if ('fail' in outcome) return outcome.fail;
		paymentsRedirect(outcome.notice);
	},

	notifyPaymentDueEmail: async ({ request, locals }) => {
		const outcome = await runPaymentDueNotifyAction(request, locals, notifyParentsPaymentDueEmail);
		if ('fail' in outcome) return outcome.fail;
		paymentsRedirect(outcome.notice);
	},

	notifyPaymentDuePush: async ({ request, locals }) => {
		const outcome = await runPaymentDueNotifyAction(request, locals, notifyParentsPaymentDuePush);
		if ('fail' in outcome) return outcome.fail;
		paymentsRedirect(outcome.notice);
	},

	registerInboundDeposit: async ({ request, locals }) => {
		const rg = gateFinanceAction(locals);
		if (!rg.ok) return failFromGate(rg);
		let academyId;
		try {
			({ academyId } = await withAcademyScope());
		} catch {
			return fail(503, { error: 'DB에 연결할 수 없습니다.' });
		}
		const data = await request.formData();
		const amount = parseAmount(String(data.get('amountKrw') ?? ''));
		if ('error' in amount) return fail(400, { error: amount.error });

		const depositedAtRaw = String(data.get('depositedAt') ?? '').trim();
		if (!isYmdSeoulCalendarDate(depositedAtRaw))
			return fail(400, { error: '입금일이 올바르지 않습니다.' });
		const depositedAt = new Date(`${depositedAtRaw}T12:00:00+09:00`);

		const memo = String(data.get('memo') ?? '').trim();
		if (memo.length > MAX_MEMO)
			return fail(400, { error: `입금 비고는 ${MAX_MEMO}자 이하로 입력하세요.` });

		const externalRef = String(data.get('externalRef') ?? '').trim();
		if (externalRef.length > MAX_EXT_REF)
			return fail(400, { error: `거래 참조값은 ${MAX_EXT_REF}자 이하로 입력하세요.` });

		await BankDeposit.create({
			academyId,
			amountKrw: amount.value,
			depositedAt,
			memo: memo || undefined,
			externalRef: externalRef || undefined,
			status: 'unmatched'
		});
		return { success: true as const };
	},

	importOpenBankingStubDeposit: async ({ request, locals }) => {
		const rg = gateFinanceAction(locals);
		if (!rg.ok) return failFromGate(rg);
		if (process.env.OPEN_BANKING_ENABLED !== 'true') {
			return fail(400, { error: '오픈뱅킹 스텁이 비활성화되어 있습니다.' });
		}
		let academyId;
		try {
			({ academyId } = await withAcademyScope());
		} catch {
			return fail(503, { error: 'DB에 연결할 수 없습니다.' });
		}
		const data = await request.formData();
		const externalIdRaw = String(data.get('externalId') ?? '');
		const externalId = externalIdRaw.trim();
		if (!externalId) return fail(400, { error: '외부 ID가 필요합니다.' });
		if (externalId.length > MAX_EXT_REF)
			return fail(400, { error: `거래 참조값은 ${MAX_EXT_REF}자 이하로 입력하세요.` });

		const amount = parseAmount(String(data.get('amountKrw') ?? ''));
		if ('error' in amount) return fail(400, { error: amount.error });

		const depositedAtRaw = String(data.get('depositedAt') ?? '').trim();
		const depositedAtParsed = new Date(depositedAtRaw);
		if (!Number.isFinite(depositedAtParsed.getTime()))
			return fail(400, { error: '입금일시가 올바르지 않습니다.' });
		const depositedAtMs = depositedAtParsed.getTime();

		const stubs = stubTransactionsForPreviewMonth();
		const stub = findMatchingStubTransaction(stubs, externalId, amount.value, depositedAtMs);
		if (!stub) return fail(400, { error: '스텁과 일치하지 않습니다.' });

		const dup = await BankDeposit.exists({
			academyId,
			externalRef: externalId
		});
		if (dup) return fail(400, { error: '이미 등록된 스텁 입금입니다.' });

		const memoFromStub = stub.memo?.trim();
		await BankDeposit.create({
			academyId,
			amountKrw: stub.amountKrw,
			depositedAt: stub.depositedAt,
			memo: memoFromStub || 'open-banking stub',
			externalRef: externalId,
			status: 'unmatched'
		});
		return { success: true as const };
	},

	matchDeposit: async ({ request, locals }) => {
		const rg = gateFinanceAction(locals);
		if (!rg.ok) return failFromGate(rg);
		const uid = locals.user?.id;
		if (!uid) return fail(401, { error: '로그인이 필요합니다.' });
		let academyId;
		try {
			({ academyId } = await withAcademyScope());
		} catch {
			return fail(503, { error: 'DB에 연결할 수 없습니다.' });
		}
		const data = await request.formData();
		const depositId = String(data.get('depositId') ?? '');
		const invoiceLineId = String(data.get('invoiceLineId') ?? '');
		if (!isOid(depositId) || !isOid(invoiceLineId))
			return fail(400, { error: '항목 선택이 올바르지 않습니다.' });

		const deposit = await BankDeposit.findOne({
			_id: depositId,
			academyId,
			status: 'unmatched'
		}).lean();
		if (!deposit) return fail(400, { error: '미매칭 입금을 찾을 수 없습니다.' });

		const openLine = await InvoiceLine.findOne({
			_id: invoiceLineId,
			academyId,
			status: 'open'
		}).lean();
		if (!openLine) return fail(400, { error: '미납 청구를 찾을 수 없습니다.' });

		if (openLine.amountKrw !== deposit.amountKrw)
			return fail(400, { error: '입금 금액과 청구 금액이 같을 때만 매칭할 수 있습니다.' });

		const paidAt = deposit.depositedAt;

		const updated = await InvoiceLine.findOneAndUpdate(
			{
				_id: invoiceLineId,
				academyId,
				status: 'open',
				amountKrw: deposit.amountKrw
			},
			{ $set: { status: 'paid', paidAt } },
			{ new: true, lean: true }
		);

		if (!updated) return fail(400, { error: '청구 상태가 바뀌었습니다. 다시 시도하세요.' });

		let paymentDocId!: mongoose.Types.ObjectId;
		try {
			const paymentDoc = await Payment.create({
				academyId,
				invoiceLineId: updated._id,
				amountKrw: updated.amountKrw,
				method: 'bank_import',
				recordedByUserId: uid,
				paidAt,
				externalRef: deposit.externalRef,
				note: deposit.memo && deposit.memo.trim() ? `입금표시: ${deposit.memo.trim()}` : undefined
			});
			paymentDocId = paymentDoc._id;
		} catch (e) {
			console.error('[payments matchDeposit] Payment.create', e);
			await InvoiceLine.updateOne(
				{ _id: invoiceLineId, academyId },
				{ $set: { status: 'open' }, $unset: { paidAt: 1 } }
			);
			return fail(500, { error: '수납 기록 저장에 실패했습니다. 다시 시도하세요.' });
		}

		const matched = await BankDeposit.updateOne(
			{ _id: depositId, academyId, status: 'unmatched' },
			{
				$set: {
					status: 'matched',
					matchedInvoiceLineId: updated._id,
					matchedPaymentId: paymentDocId,
					matchedByUserId: uid,
					matchedAt: new Date()
				}
			}
		);

		if (matched.modifiedCount === 0 && paymentDocId) {
			await Payment.deleteOne({ _id: paymentDocId, academyId });
			await InvoiceLine.updateOne(
				{ _id: invoiceLineId, academyId },
				{ $set: { status: 'open' }, $unset: { paidAt: 1 } }
			);
			return fail(409, { error: '다른 사용자가 처리한 입금입니다. 새로고침 후 확인하세요.' });
		}

		return { success: true as const };
	},

	delete: async ({ request, locals }) => {
		const rg = gateFinanceAction(locals);
		if (!rg.ok) return failFromGate(rg);
		let academyId;
		try {
			({ academyId } = await withAcademyScope());
		} catch {
			return fail(503, { error: 'DB에 연결할 수 없습니다.' });
		}
		const data = await request.formData();
		const id = String(data.get('id') ?? '');
		if (!isOid(id)) return fail(400, { error: '잘못된 청구 ID입니다.' });
		const result = await InvoiceLine.deleteOne({ _id: id, academyId, status: 'open' });
		if (result.deletedCount === 0)
			return fail(400, { error: '미납 청구만 삭제할 수 있거나 항목을 찾지 못했습니다.' });
		return { success: true as const };
	}
};
