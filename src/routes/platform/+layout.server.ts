import { ensurePlatformSuperAdmin } from '$lib/server/rbac';
import type { LayoutServerLoad } from './$types';

export const load: LayoutServerLoad = async ({ locals }) => {
	ensurePlatformSuperAdmin(locals);
	return {};
};
