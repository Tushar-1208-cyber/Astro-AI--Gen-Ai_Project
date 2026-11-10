import { NextRequest, NextResponse } from 'next/server';
import bcrypt from 'bcryptjs';
import { z } from 'zod';
import dbConnect from '@/lib/db';
import User from '@/models/User';
import { getAuthenticatedUser } from '@/lib/auth';
import { checkRateLimit } from '@/lib/rate-limiter';
import { validateSameOrigin } from '@/lib/security';

const ChangePasswordSchema = z.object({
  currentPassword: z.string().min(1, 'Current password is required'),
  newPassword: z.string().min(6, 'New password must be at least 6 characters long').max(100, 'Password is too long'),
});

export async function POST(req: NextRequest) {
  try {
    if (!validateSameOrigin(req)) {
      return NextResponse.json({ error: 'Invalid request origin' }, { status: 403 });
    }

    const authUser = await getAuthenticatedUser();
    if (!authUser) {
      return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
    }

    // Rate limit password change attempts
    const rateLimit = await checkRateLimit(`change-password:${authUser.userId}`, 5, 900);
    if (!rateLimit.success) {
      return NextResponse.json(
        { error: 'Too many password update attempts. Please wait 15 minutes before trying again.' },
        { status: 429 }
      );
    }

    let body;
    try {
      body = await req.json();
    } catch {
      return NextResponse.json({ error: 'Malformed JSON payload' }, { status: 400 });
    }

    const validation = ChangePasswordSchema.safeParse(body);
    if (!validation.success) {
      const msg = validation.error.errors[0]?.message || 'Invalid input data';
      return NextResponse.json({ error: msg }, { status: 400 });
    }

    const { currentPassword, newPassword } = validation.data;

    await dbConnect();
    const user = await User.findById(authUser.userId);
    if (!user) {
      return NextResponse.json({ error: 'User account not found' }, { status: 404 });
    }

    // Verify current password
    const isMatch = await bcrypt.compare(currentPassword, user.password);
    if (!isMatch) {
      return NextResponse.json({ error: 'Current password is incorrect.' }, { status: 401 });
    }

    // Hash new password
    const hashedNewPassword = await bcrypt.hash(newPassword, 10);
    user.password = hashedNewPassword;
    user.updatedAt = new Date();
    await user.save();

    return NextResponse.json({ message: 'Password updated successfully!' });
  } catch (error: any) {
    console.error('[ChangePassword] Error:', error);
    return NextResponse.json({ error: 'Failed to update password' }, { status: 500 });
  }
}
