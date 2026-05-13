import mongoose, { Schema, model, type Types } from 'mongoose';

/** 미매칭·매칭된 입금 줄(외부 입금 피드 또는 수기 등록 MVP) — PRD §7.3 / §6.6 */
export const bankDepositStatuses = ['unmatched', 'matched'] as const;
export type BankDepositStatus = (typeof bankDepositStatuses)[number];

export type BankDepositDoc = {
	academyId: Types.ObjectId;
	amountKrw: number;
	depositedAt: Date;
	memo?: string;
	externalRef?: string;
	status: BankDepositStatus;
	matchedInvoiceLineId?: Types.ObjectId;
	matchedPaymentId?: Types.ObjectId;
	matchedByUserId?: string;
	matchedAt?: Date;
};

const BankDepositSchema = new Schema<BankDepositDoc>(
	{
		academyId: { type: Schema.Types.ObjectId, required: true, index: true },
		amountKrw: { type: Number, required: true, min: 1 },
		depositedAt: { type: Date, required: true, index: true },
		memo: { type: String, maxlength: 200 },
		externalRef: { type: String, maxlength: 128 },
		status: {
			type: String,
			enum: bankDepositStatuses,
			required: true,
			default: 'unmatched',
			index: true
		},
		matchedInvoiceLineId: { type: Schema.Types.ObjectId, ref: 'InvoiceLine', index: true },
		matchedPaymentId: { type: Schema.Types.ObjectId, ref: 'Payment' },
		matchedByUserId: { type: String },
		matchedAt: { type: Date }
	},
	{ timestamps: true }
);

BankDepositSchema.index({ academyId: 1, status: 1, depositedAt: -1 });

export const BankDeposit =
	mongoose.models.BankDeposit ?? model<BankDepositDoc>('BankDeposit', BankDepositSchema);
