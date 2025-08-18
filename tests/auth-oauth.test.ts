// Test for OAuth flow
import { generateToken, verifyToken } from '../src/auth.js';
import { describe, it, expect } from 'vitest';

describe('OAuth Flow Tests', () => {
  const mockUser = {
    id: 'github_123456',
    username: 'testuser',
    email: 'test@example.com',
    githubId: '123456',
    avatarUrl: 'https://avatars.githubusercontent.com/u/123456',
    accessToken: 'gho_testAccessToken123456789'
  };

  it('should include accessToken in JWT payload for dashboard API calls', () => {
    const token = generateToken(mockUser);
    expect(token).toBeDefined();
    
    const decoded = verifyToken(token);
    expect(decoded).toBeDefined();
    expect(decoded.accessToken).toBe(mockUser.accessToken);
    expect(decoded.id).toBe(mockUser.id);
    expect(decoded.username).toBe(mockUser.username);
    expect(decoded.email).toBe(mockUser.email);
    expect(decoded.githubId).toBe(mockUser.githubId);
  });

  it('should handle token verification correctly', () => {
    const token = generateToken(mockUser);
    const decoded = verifyToken(token);
    
    expect(decoded).toBeDefined();
    expect(decoded.accessToken).toBeTruthy();
  });

  it('should reject invalid tokens', () => {
    const invalidToken = 'invalid.token.here';
    const decoded = verifyToken(invalidToken);
    
    expect(decoded).toBe(null);
  });
});