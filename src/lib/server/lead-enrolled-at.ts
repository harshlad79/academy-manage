import type { Types } from 'mongoose';

import { Lead } from '$lib/server/models/lead';

export async function syncLeadEnrolledAt(options: {
	academyId: Types.ObjectId;
	studentId: Types.ObjectId;
	at?: Date;
}): Promise<void> {
	await Lead.updateOne(
		{
			academyId: options.academyId,
			studentId: options.studentId,
			enrolledAt: { $exists: false }
		},
		{ $set: { enrolledAt: options.at ?? new Date() } }
	);
}
