import { building } from '$app/environment';
import { svelteKitHandler } from 'better-auth/svelte-kit';
import { betterAuth } from 'better-auth';
import { getAuth, isMockAuthMode } from '$lib/server/auth';
import { ACTIVE_ACADEMY_COOKIE, resolveActiveAcademyContext } from '$lib/server/active-academy';
import { needsTermsAcceptance, shouldSkipTermsGate } from '$lib/server/terms-gate';
import { redirect, type Handle } from '@sveltejs/kit';

type AuthInstance = ReturnType<typeof betterAuth>;

async function attachAcademyMembership(event: Parameters<Handle>[0]['event']) {
	event.locals.academyMembership = null;
	event.locals.activeAcademyId = undefined;
	event.locals.academyOperationalStatus = undefined;
	const uid = event.locals.user?.id;
	if (!uid) return;

	try {
		const cookieHex = event.cookies.get(ACTIVE_ACADEMY_COOKIE);
		const resolved = await resolveActiveAcademyContext(uid, cookieHex);
		if (!resolved) return;
		event.locals.academyMembership = resolved.membership;
		event.locals.activeAcademyId = resolved.academyId;
		event.locals.academyOperationalStatus = resolved.academyOperationalStatus;
	} catch (e) {
		console.warn('[hooks] academyMembership resolve skipped', e);
	}
}

export const handle: Handle = async ({ event, resolve }) => {
	event.locals.user = null;
	event.locals.session = null;
	event.locals.academyMembership = null;
	event.locals.activeAcademyId = undefined;
	event.locals.academyOperationalStatus = undefined;

	if (isMockAuthMode()) {
		const bundle = (await getAuth().api.getSession({
			headers: event.request.headers
		})) as { user: App.Locals['user']; session: App.Locals['session'] };
		event.locals.user = bundle.user;
		event.locals.session = bundle.session;
		await attachAcademyMembership(event);
		return resolve(event);
	}

	const auth = getAuth() as AuthInstance;
	const bundle = await auth.api.getSession({ headers: event.request.headers });
	if (bundle) {
		event.locals.user = bundle.user;
		event.locals.session = bundle.session;

		if (
			!isMockAuthMode() &&
			event.locals.user &&
			needsTermsAcceptance(event.locals.user as { termsAcceptedAt?: Date | null })
		) {
			const path = event.url.pathname;
			if (!shouldSkipTermsGate(path)) {
				const next = `${path}${event.url.search}`;
				redirect(303, `/auth/accept-terms?next=${encodeURIComponent(next)}`);
			}
		}

		await attachAcademyMembership(event);
	}
	return svelteKitHandler({ event, resolve, auth, building });
};
