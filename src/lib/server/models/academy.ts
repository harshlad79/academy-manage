import mongoose, { Schema, model } from 'mongoose';

export type AcademyStatus = 'trial' | 'active' | 'inactive';

export type AcademyDoc = {
	name: string;
	status: AcademyStatus;
	trialEndsAt?: Date;
	billingAutoImport: boolean;
	parentPortalEnabled: boolean;
	communicationsEnabled: boolean;
	createdAt: Date;
	updatedAt: Date;
};

const AcademySchema = new Schema<AcademyDoc>(
	{
		name: { type: String, required: true, trim: true },
		status: {
			type: String,
			enum: ['trial', 'active', 'inactive'],
			required: true,
			default: 'active'
		},
		trialEndsAt: { type: Date },
		billingAutoImport: { type: Boolean, default: false },
		parentPortalEnabled: { type: Boolean, default: true },
		communicationsEnabled: { type: Boolean, default: true }
	},
	{ timestamps: true }
);

AcademySchema.index({ status: 1, name: 1 });

export const Academy = mongoose.models.Academy ?? model<AcademyDoc>('Academy', AcademySchema);
