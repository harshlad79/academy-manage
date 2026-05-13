import mongoose, { Schema, model, type Types } from 'mongoose';

export const invoiceLineStatuses = ['open', 'paid'] as const;
export type InvoiceLineStatus = (typeof invoiceLineStatuses)[number];

export type InvoiceLineDoc = {
	academyId: Types.ObjectId;
	enrollmentId: Types.ObjectId;
	amountKrw: number;
	description: string;
	dueDate: string;
	status: InvoiceLineStatus;
	paidAt?: Date;
};

const InvoiceLineSchema = new Schema<InvoiceLineDoc>(
	{
		academyId: { type: Schema.Types.ObjectId, required: true, index: true },
		enrollmentId: { type: Schema.Types.ObjectId, ref: 'Enrollment', required: true, index: true },
		amountKrw: { type: Number, required: true, min: 1 },
		description: { type: String, required: true, maxlength: 500 },
		dueDate: { type: String, required: true },
		status: {
			type: String,
			required: true,
			enum: invoiceLineStatuses,
			default: 'open'
		},
		paidAt: { type: Date }
	},
	{ timestamps: true }
);

export const InvoiceLine =
	mongoose.models.InvoiceLine ?? model<InvoiceLineDoc>('InvoiceLine', InvoiceLineSchema);
