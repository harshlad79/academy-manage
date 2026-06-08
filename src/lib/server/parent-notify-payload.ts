/** 미납 안내 알림(SMS·이메일·푸시) 공통 페이로드. */
export type PaymentDueNotifyPayload = {
	academyName: string;
	studentName: string;
	amountKrw: number;
	dueDate: Date;
	description: string;
};

export function formatPaymentDueWon(amountKrw: number): string {
	return `${amountKrw.toLocaleString('ko-KR')}원`;
}
