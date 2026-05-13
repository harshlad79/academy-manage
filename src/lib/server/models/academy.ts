import mongoose, { Schema, model } from 'mongoose';

export type AcademyStatus = 'active' | 'inactive';

export type AcademyDoc = {
	name: string;
	status: AcademyStatus;
	createdAt: Date;
	updatedAt: Date;
};

const AcademySchema = new Schema<AcademyDoc>(
	{
		name: { type: String, required: true, trim: true },
		status: {
			type: String,
			enum: ['active', 'inactive'],
			required: true,
			default: 'active'
		}
	},
	{ timestamps: true }
);

AcademySchema.index({ status: 1, name: 1 });

export const Academy = mongoose.models.Academy ?? model<AcademyDoc>('Academy', AcademySchema);
