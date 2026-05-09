import { betterAuth } from "better-auth";
import { mongodbAdapter } from "better-auth/adapters/mongodb";
import { MongoClient } from "mongodb";
import { env } from '$env/dynamic/private';

const authMode = env.AUTH_MODE || 'mock';

let authInstance: any;

if (authMode === 'mock') {
    authInstance = {
        signIn: async () => ({ data: { id: 'mock-user', name: 'Mock User' }, error: null }),
        signUp: async () => ({ data: { id: 'mock-user', name: 'Mock User' }, error: null }),
        signOut: async () => ({ error: null }),
        getSession: async () => ({ data: { user: { id: 'mock-user', name: 'Mock User' }, session: { id: 'mock-session' } }, error: null }),
    };
} else {
    const client = new MongoClient(env.DB_URL!);
    authInstance = betterAuth({
        database: mongodbAdapter(client.db("academy-db")),
        secret: env.BETTER_AUTH_SECRET,
    });
}

export const auth = authInstance;
