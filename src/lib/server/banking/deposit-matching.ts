/**
 * 미매칭 입금 ↔ 미납 청구 자동 매칭 제안 (PRD §7.3, `billingAutoImport` 플래그).
 * 순수 함수 — 입금 금액과 동일한 미납 청구 중 입금 표시(memo)에 학생명이 나타나면
 * 'high', 후보가 하나뿐이면 'medium' 신뢰도로 제안한다. 확정은 수동(관리자·행정)이다.
 */

export type DepositForMatching = {
	id: string;
	amountKrw: number;
	depositedAt: string;
	memo: string | null;
};

export type InvoiceLineForMatching = {
	id: string;
	enrollmentId: string;
	studentName: string;
	courseName: string;
	amountKrw: number;
	description: string;
	dueDate: string;
	status: 'open' | 'paid';
	paidAt: string | null;
};

export type DepositMatchSuggestion = {
	depositId: string;
	invoiceLineId: string;
	confidence: 'high' | 'medium';
	candidateCount: number;
};

function memoNamesStudent(memo: string, studentName: string): boolean {
	const m = memo.replace(/\s+/g, '').toLowerCase();
	const s = studentName.replace(/\s+/g, '').toLowerCase();
	return s.length >= 2 && m.includes(s);
}

export function suggestDepositMatches(
	deposits: DepositForMatching[],
	lines: InvoiceLineForMatching[]
): DepositMatchSuggestion[] {
	const openLines = lines.filter((l) => l.status === 'open');
	const suggestions: DepositMatchSuggestion[] = [];

	for (const dep of deposits) {
		const candidates = openLines.filter((l) => l.amountKrw === dep.amountKrw);
		if (candidates.length === 0) continue;

		const memo = dep.memo?.trim() ?? '';
		const named = memo
			? candidates.find((l) => l.studentName !== '—' && memoNamesStudent(memo, l.studentName))
			: undefined;

		if (named) {
			suggestions.push({
				depositId: dep.id,
				invoiceLineId: named.id,
				confidence: 'high',
				candidateCount: candidates.length
			});
		} else if (candidates.length === 1) {
			suggestions.push({
				depositId: dep.id,
				invoiceLineId: candidates[0].id,
				confidence: 'medium',
				candidateCount: 1
			});
		}
	}

	return suggestions;
}
