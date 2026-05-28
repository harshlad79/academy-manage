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

export function academyBlocksExternalComms(
	status: AcademyStatus,
	_trialEndsAt: Date | undefined | null,
	_now?: Date
): boolean {
	return status === 'trial';
}
