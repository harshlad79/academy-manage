import type { Types } from 'mongoose';

import { academyBlocksExternalComms } from '$lib/server/academy-trial';
import type { AcademyStatus } from '$lib/server/models/academy';
import type { LoadAcademyTrialGate } from '$lib/server/invite-mail';

/** trial 학원은 외부 알림(SMS·이메일·푸시) 차단. */
export async function parentNotifyBlockedByTrial(
	academyId: Types.ObjectId | undefined,
	loadGate?: LoadAcademyTrialGate
): Promise<boolean> {
	if (!academyId) return false;
	const gate =
		loadGate ??
		(async (id) => {
			const { Academy } = await import('$lib/server/models/academy');
			const doc = await Academy.findById(id).select('status trialEndsAt').lean();
			if (!doc) return null;
			return { status: doc.status as AcademyStatus, trialEndsAt: doc.trialEndsAt };
		});
	const row = await gate(academyId);
	if (!row) return false;
	return academyBlocksExternalComms(row.status);
}
