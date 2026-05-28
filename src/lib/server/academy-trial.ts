import type { AcademyStatus } from '$lib/server/models/academy';

export function isTrialExpired(
	status: AcademyStatus,
	trialEndsAt: Date | undefined | null,
	now: Date = new Date()
): boolean {
	if (status !== 'trial') return false;
	if (trialEndsAt == null) return false;
	return now.getTime() > trialEndsAt.getTime();
}

export function academyBlocksStaffApp(
	status: AcademyStatus,
	trialEndsAt: Date | undefined | null,
	now?: Date
): boolean {
	return isTrialExpired(status, trialEndsAt, now);
}

export function academyBlocksExternalComms(status: AcademyStatus): boolean {
	return status === 'trial';
}
