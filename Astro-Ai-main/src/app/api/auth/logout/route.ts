import { NextRequest, NextResponse } from 'next/server';
import { AUTH_COOKIE_NAME, revokeToken } from '@/lib/auth';

export async function POST(req: NextRequest) {
  // Extract token from cookie or Authorization header to revoke server-side
  const cookieToken = req.cookies.get(AUTH_COOKIE_NAME)?.value;
  const authHeader = req.headers.get('authorization');
  const headerToken = authHeader?.startsWith('Bearer ') ? authHeader.substring(7).trim() : undefined;
  const tokenToRevoke = cookieToken || headerToken;

  if (tokenToRevoke) {
    await revokeToken(tokenToRevoke);
  }

  const response = NextResponse.json({ message: 'Logged out successfully' });

  // Invalidate HTTP-only cookie on client
  response.cookies.set(AUTH_COOKIE_NAME, '', {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge: 0,
    expires: new Date(0),
    path: '/',
  });

  return response;
}
