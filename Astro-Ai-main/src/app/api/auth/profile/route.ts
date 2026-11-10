import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import dbConnect from '@/lib/db';
import User from '@/models/User';
import { getAuthenticatedUser, createAuthToken, getAuthCookieOptions, AUTH_COOKIE_NAME } from '@/lib/auth';
import { checkRateLimit } from '@/lib/rate-limiter';
import { validateSameOrigin } from '@/lib/security';

const ProfileUpdateSchema = z.object({
  name: z.string().trim().min(2, 'Name must be at least 2 characters').max(50, 'Name is too long').optional(),
  email: z.string().trim().email('Invalid email address').toLowerCase().optional(),
});

export async function PATCH(req: NextRequest) {
  try {
    if (!validateSameOrigin(req)) {
      return NextResponse.json({ error: 'Invalid request origin' }, { status: 403 });
    }

    const authUser = await getAuthenticatedUser();
    if (!authUser) {
      return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
    }

    const rateLimit = await checkRateLimit(`profile-update:${authUser.userId}`, 10, 900);
    if (!rateLimit.success) {
      return NextResponse.json({ error: 'Too many profile updates. Please try again later.' }, { status: 429 });
    }

    let body;
    try {
      body = await req.json();
    } catch {
      return NextResponse.json({ error: 'Malformed JSON payload' }, { status: 400 });
    }

    const validation = ProfileUpdateSchema.safeParse(body);
    if (!validation.success) {
      const msg = validation.error.errors[0]?.message || 'Invalid input data';
      return NextResponse.json({ error: msg }, { status: 400 });
    }

    const { name, email } = validation.data;

    await dbConnect();
    const user = await User.findById(authUser.userId);
    if (!user) {
      return NextResponse.json({ error: 'User account not found' }, { status: 404 });
    }

    // If changing email, check for duplicate
    if (email && email !== user.email) {
      const duplicate = await User.findOne({ email, _id: { $ne: user._id } });
      if (duplicate) {
        return NextResponse.json({ error: 'An account with this email address already exists.' }, { status: 409 });
      }
      user.email = email;
    }

    if (name !== undefined) {
      user.name = name;
    }

    user.updatedAt = new Date();
    await user.save();

    // Re-issue updated session token with new details
    const newToken = createAuthToken({
      userId: user._id.toString(),
      email: user.email,
      name: user.name,
      role: user.role || 'teacher',
    });

    const response = NextResponse.json({
      message: 'Profile updated successfully',
      user: {
        id: user._id.toString(),
        email: user.email,
        name: user.name,
        role: user.role || 'teacher',
      },
    });

    response.cookies.set(AUTH_COOKIE_NAME, newToken, getAuthCookieOptions());
    return response;
  } catch (error: any) {
    console.error('[ProfileUpdate] Error:', error);
    return NextResponse.json({ error: 'Failed to update profile' }, { status: 500 });
  }
}
