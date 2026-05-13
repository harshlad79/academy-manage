import mongoose, { Schema, model, type Types } from 'mongoose';

/** PRD §7 — 수기 수납·향후 은행 거래 매칭 */
export const paymentMethods = ['manual', 'bank_import'] as const;
export type PaymentMethod = (typeof paymentMethods)[number];

export type PaymentDoc = {
	academyId: Types.ObjectId;
	invoiceLineId: Types.ObjectId;
	amountKrw: number;
	method: PaymentMethod;
	recordedByUserId: string;
	paidAt: Date;
	note?: string;
	externalRef?: string;
};

const PaymentSchema = new Schema<PaymentDoc>(
	{
		academyId: { type: Schema.Types.ObjectId, required: true, index: true },
		invoiceLineId: { type: Schema.Types.ObjectId, ref: 'InvoiceLine', required: true, index: true },
		amountKrw: { type: Number, required: true, min: 1 },
		method: { type: String, enum: paymentMethods, required: true },
		recordedByUserId: { type: String, required: true, index: true },
		paidAt: { type: Date, required: true, index: true },
		note: { type: String },
		externalRef: { type: String }
	},
	{ timestamps: true }
);

PaymentSchema.index({ academyId: 1, paidAt: -1 });

export const Payment = mongoose.models.Payment ?? model<PaymentDoc>('Payment', PaymentSchema);
