import { betterAuth } from 'better-auth';
import { mongodbAdapter } from 'better-auth/adapters/mongodb';
import { MongoClient } from 'mongodb';
import type { Session, User } from 'better-auth/types';
import { env } from '$env/dynamic/private';
import { buildSocialProviders } from '$lib/server/auth-social';

export function isMockAuthMode(): boolean {
	return (env.AUTH_MODE ?? 'mock') === 'mock';
}

const MOCK_USER_PROFILES: Record<string, { name: string; email: string }> = {
	superadmin: { name: '전체관리자(목업)', email: 'superadmin@example.com' },
	testuser: { name: '테스트 사용자', email: 'test@example.com' },
	'parent-kim': { name: '김 학부모', email: 'parent-kim@example.com' }
};

function resolveMockUserId(): string {
	const raw = env.AUTH_MOCK_USER_ID?.trim();
	if (!raw) return 'testuser';
	return MOCK_USER_PROFILES[raw] ? raw : 'testuser';
}

const mockSessionBundle = (): { user: User; session: Session } => {
	const id = resolveMockUserId();
	const p = MOCK_USER_PROFILES[id];
	const userRow = {
		id,
		name: p.name,
		email: p.email,
		emailVerified: true,
		image: undefined,
		createdAt: new Date(),
		updatedAt: new Date()
	} as User;
	return {
		user: userRow,
		session: {
			id: 'mock-session',
			userId: id,
			expiresAt: new Date(Date.now() + 86400000 * 30),
			createdAt: new Date(),
			updatedAt: new Date(),
			token: 'mock-token'
		} as Session
	};
};

/** 목업 모드용: Better Auth `api.getSession` 형태에 맞춘 최소 구현 */
const mockAuthStub = {
	api: {
		getSession: async () => mockSessionBundle()
	}
};

let liveAuth: ReturnType<typeof betterAuth> | null = null;
let mongoClient: MongoClient | null = null;

function getLiveAuth(): ReturnType<typeof betterAuth> {
	if (liveAuth) return liveAuth;
	const url = env.DB_URL;
	const secret = env.BETTER_AUTH_SECRET;
	if (!url?.trim() || !secret?.trim()) {
		throw new Error('AUTH_MODE=live 일 때 DB_URL, BETTER_AUTH_SECRET 이 필요합니다.');
	}
	mongoClient = new MongoClient(url);
	const baseURL = (env.BETTER_AUTH_URL ?? 'http://localhost:5173').replace(/\/$/, '');
	liveAuth = betterAuth({
		database: mongodbAdapter(mongoClient.db('academy-db')),
		secret,
		baseURL,
		trustedOrigins: [baseURL],
		user: {
			additionalFields: {
				termsAcceptedAt: {
					type: 'date',
					required: false,
					input: false
				}
			}
		},
		socialProviders: buildSocialProviders({
			KAKAO_CLIENT_ID: env.KAKAO_CLIENT_ID,
			KAKAO_CLIENT_SECRET: env.KAKAO_CLIENT_SECRET,
			NAVER_CLIENT_ID: env.NAVER_CLIENT_ID,
			NAVER_CLIENT_SECRET: env.NAVER_CLIENT_SECRET,
			GOOGLE_CLIENT_ID: env.GOOGLE_CLIENT_ID,
			GOOGLE_CLIENT_SECRET: env.GOOGLE_CLIENT_SECRET
		}),
		// PRD는 소셜 중심이나, OAuth 키 없이 로컬에서 live 모드를 열 수 있도록 비밀번호 경로 허용
		emailAndPassword: { enabled: true }
	}) as unknown as ReturnType<typeof betterAuth>;
	return liveAuth;
}

export function getAuth() {
	return isMockAuthMode() ? mockAuthStub : getLiveAuth();
}

export { isAnySocialProviderConfigured, listEnabledSocialProviders } from '$lib/server/auth-social';

/** Better Auth `academy-db` 의 `user` 컬렉션에 id 가 존재하는지(live 전용). mock 은 항상 true. */
export async function liveBetterAuthUserExists(userId: string): Promise<boolean> {
	const id = userId.trim();
	if (!id) return false;
	if (isMockAuthMode()) return true;
	getLiveAuth();
	if (!mongoClient) return false;
	const col = mongoClient.db('academy-db').collection('user');
	const found = await col.findOne({ $or: [{ id }, { userId: id }] }, { projection: { _id: 1 } });
	return found !== null;
}
