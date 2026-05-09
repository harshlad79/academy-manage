import { describe, it, expect, vi } from 'vitest';
import { auth } from './auth';

describe('Auth Toggle', () => {
  it('should return mock user when in mock mode', async () => {
    // In our setup, AUTH_MODE is set to 'mock' in .env, 
    // which is loaded by the environment.
    const session = await auth.getSession();
    expect(session.data.user.name).toBe('Mock User');
  });
});
