import { createAuthClient } from 'better-auth/svelte';
import { env } from '$env/dynamic/public';

/** 브라우저에서 로그인·로그아웃 등에 사용. mock 모드에서는 UI만 준비됩니다. */
export const authClient = createAuthClient({
	baseURL: env.PUBLIC_BETTER_AUTH_URL || undefined
});
