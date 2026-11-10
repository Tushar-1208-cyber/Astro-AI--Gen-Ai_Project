import { NextResponse } from 'next/server';
import dbConnect from '@/lib/db';
import User from '@/models/User';
import { getAuthenticatedUser, AUTH_COOKIE_NAME } from '@/lib/auth';

export async function GET() {
  try {
    const authUser = await getAuthenticatedUser();

    if (!authUser) {
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
    }

    await dbConnect();
    const user = await User.findById(authUser.userId).select('-password');

    if (!user) {
      // User account was deleted, clear stale session
      const response = NextResponse.json({ error: 'User account not found' }, { status: 401 });
      response.cookies.set(AUTH_COOKIE_NAME, '', { maxAge: 0, path: '/' });
      return response;
    }

    return NextResponse.json({
      user: {
        id: user._id.toString(),
        email: user.email,
        name: user.name || '',
        role: user.role || 'teacher',
        createdAt: user.createdAt,
      },
    });
  } catch (error) {
    console.error('[Auth/Me] Error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
