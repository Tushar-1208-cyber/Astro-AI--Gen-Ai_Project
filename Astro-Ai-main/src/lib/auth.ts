import jwt from 'jsonwebtoken';
import { cookies, headers } from 'next/headers';
import crypto from 'crypto';
import dbConnect from './db';
import RevokedToken from '@/models/RevokedToken';

export interface AuthenticatedUser {
  userId: string;
  email: string;
  name?: string;
  role?: string;
  jti?: string;
}

export const AUTH_COOKIE_NAME = 'auth_token';
export const AUTH_TOKEN_EXPIRY_SECONDS = 7 * 24 * 60 * 60; // 7 days

/**
 * Returns the cryptographically secure JWT secret or throws an error.
 * Secure Fail: Never uses hardcoded fallback strings.
 */
export function getJwtSecret(): string {
  const secret = process.env.JWT_SECRET;
  if (!secret || secret.trim().length === 0) {
    throw new Error('FATAL: JWT_SECRET environment variable is missing. Authentication disabled for security.');
  }
  return secret.trim();
}

/**
 * Standard cookie configuration for session tokens
 */
export function getAuthCookieOptions() {
  const isProduction = process.env.NODE_ENV === 'production';
  return {
    httpOnly: true,
    secure: isProduction,
    sameSite: 'lax' as const,
    maxAge: AUTH_TOKEN_EXPIRY_SECONDS,
    path: '/',
  };
}

/**
 * Signs a JWT token with HS256 algorithm, unique jti, and 7-day expiration.
 * Unique jti provides unambiguous identity for server-side token revocation upon logout.
 */
export function createAuthToken(user: { userId: string; email: string; name?: string; role?: string; jti?: string }): string {
  const secret = getJwtSecret();
  const jti = user.jti || crypto.randomUUID();
  const payload = {
    userId: user.userId,
    email: user.email.toLowerCase().trim(),
    name: user.name || '',
    role: user.role || 'teacher',
  };

  return jwt.sign(payload, secret, {
    algorithm: 'HS256',
    expiresIn: AUTH_TOKEN_EXPIRY_SECONDS,
    jwtid: jti,
  });
}

/**
 * Checks if a token with the given jti has been revoked in MongoDB.
 * Multi-instance ready: queries the shared database with automatic TTL expiration.
 */
export async function isTokenRevoked(jti: string): Promise<boolean> {
  if (!jti) return true;
  try {
    await dbConnect();
    const record = await RevokedToken.findOne({ jti });
    return !!record;
  } catch (error) {
    console.error('[Auth] Error checking token revocation:', error);
    // Secure failure mode: fail closed
    return true;
  }
}

/**
 * Revokes a JWT server-side by recording its jti in MongoDB with TTL expiration.
 * The revocation entry automatically expires once the token's original expiration date passes.
 */
export async function revokeToken(token: string): Promise<boolean> {
  if (!token || typeof token !== 'string') {
    return false;
  }

  try {
    const decoded = jwt.decode(token) as any;
    if (!decoded || !decoded.jti) {
      return false;
    }

    await dbConnect();
    const expiresAt = decoded.exp
      ? new Date(decoded.exp * 1000)
      : new Date(Date.now() + AUTH_TOKEN_EXPIRY_SECONDS * 1000);

    await RevokedToken.findOneAndUpdate(
      { jti: decoded.jti },
      {
        $setOnInsert: {
          jti: decoded.jti,
          userId: decoded.userId || 'unknown',
          revokedAt: new Date(),
          expiresAt,
        },
      },
      { upsert: true }
    );

    return true;
  } catch (error) {
    console.error('[Auth] Error revoking token:', error);
    return false;
  }
}

/**
 * Verifies a raw JWT string and returns the decoded user payload, or null if invalid, expired, or revoked.
 */
export async function verifyAuthToken(token: string): Promise<AuthenticatedUser | null> {
  if (!token || typeof token !== 'string') {
    return null;
  }

  try {
    const secret = getJwtSecret();
    const decoded = jwt.verify(token, secret, { algorithms: ['HS256'] }) as any;

    if (!decoded || !decoded.userId || !decoded.email) {
      return null;
    }

    // Verify token has not been revoked server-side
    if (decoded.jti) {
      const revoked = await isTokenRevoked(decoded.jti);
      if (revoked) {
        return null;
      }
    }

    return {
      userId: decoded.userId,
      email: decoded.email,
      name: decoded.name || '',
      role: decoded.role || 'teacher',
      jti: decoded.jti,
    };
  } catch (err: any) {
    // Expired, signature mismatch, or malformed
    return null;
  }
}

/**
 * Centralized server-side authentication resolver.
 * Inspects HTTP-only cookies and Authorization headers.
 * Rejects revoked or expired tokens across all instances.
 * Never trusts frontend-supplied user IDs or mock accounts.
 */
export async function getAuthenticatedUser(): Promise<AuthenticatedUser | null> {
  try {
    let token: string | undefined;

    // 1. Try reading from HTTP-only cookie store
    try {
      const cookieStore = await cookies();
      token = cookieStore.get(AUTH_COOKIE_NAME)?.value;
    } catch {
      // cookies() might not be available in non-request contexts
    }

    // 2. Fallback to Authorization: Bearer <token> header if available
    if (!token) {
      try {
        const headersList = await headers();
        const authHeader = headersList.get('authorization');
        if (authHeader && authHeader.startsWith('Bearer ')) {
          token = authHeader.substring(7).trim();
        }
      } catch {
        // headers() might not be available
      }
    }

    if (!token) {
      return null;
    }

    return await verifyAuthToken(token);
  } catch (error) {
    console.error('[Auth] Error verifying session:', error);
    return null;
  }
}

/**
 * Enforces authentication. Throws an Error if unauthenticated.
 */
export async function requireAuth(): Promise<AuthenticatedUser> {
  const user = await getAuthenticatedUser();
  if (!user) {
    throw new Error('UNAUTHORIZED: Authentication required. Please log in.');
  }
  return user;
}
