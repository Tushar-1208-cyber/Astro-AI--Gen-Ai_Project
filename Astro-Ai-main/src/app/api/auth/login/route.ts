import { NextRequest, NextResponse } from 'next/server';
import bcrypt from 'bcryptjs';
import { z } from 'zod';
import dbConnect from '@/lib/db';
import User from '@/models/User';
import { createAuthToken, getAuthCookieOptions, AUTH_COOKIE_NAME } from '@/lib/auth';
import { checkRateLimit } from '@/lib/rate-limiter';
import { getClientIp, validateSameOrigin } from '@/lib/security';

const LoginSchema = z.object({
  email: z.string().trim().email('Please enter a valid email address').toLowerCase(),
  password: z.string().min(1, 'Password is required'),
});

export async function POST(req: NextRequest) {
  try {
    if (!validateSameOrigin(req)) {
      return NextResponse.json({ error: 'Invalid request origin' }, { status: 403 });
    }

    const clientIp = getClientIp(req);
    const ipRateLimit = await checkRateLimit(`login-ip:${clientIp}`, 10, 900); // 10 attempts per 15m per IP
    if (!ipRateLimit.success) {
      return NextResponse.json(
        { error: 'Too many login attempts from this network. Please try again in 15 minutes.' },
        { status: 429 }
      );
    }

    let body;
    try {
      body = await req.json();
    } catch {
      return NextResponse.json({ error: 'Malformed JSON payload' }, { status: 400 });
    }

    const validation = LoginSchema.safeParse(body);
    if (!validation.success) {
      return NextResponse.json({ error: 'Invalid email or password format.' }, { status: 400 });
    }

    const { email, password } = validation.data;

    // Email-based rate limiting to prevent targeted brute force
    const emailRateLimit = await checkRateLimit(`login-email:${email}`, 5, 900); // 5 attempts per 15m
    if (!emailRateLimit.success) {
      return NextResponse.json(
        { error: 'Too many failed login attempts for this account. Please wait 15 minutes.' },
        { status: 429 }
      );
    }

    await dbConnect();

    const user = await User.findOne({ email });
    if (!user) {
      // Generic error prevents user enumeration
      return NextResponse.json({ error: 'Invalid email or password.' }, { status: 401 });
    }

    const isPasswordValid = await bcrypt.compare(password, user.password);
    if (!isPasswordValid) {
      return NextResponse.json({ error: 'Invalid email or password.' }, { status: 401 });
    }

    // Generate authenticated JWT session
    const token = createAuthToken({
      userId: user._id.toString(),
      email: user.email,
      name: user.name,
      role: user.role || 'teacher',
    });

    const response = NextResponse.json({
      message: 'Login successful',
      user: {
        id: user._id.toString(),
        email: user.email,
        name: user.name,
        role: user.role || 'teacher',
      },
    });

    // Set secure HTTP-only cookie
    response.cookies.set(AUTH_COOKIE_NAME, token, getAuthCookieOptions());

    return response;
  } catch (error: any) {
    console.error('[Login] Error:', error.message);
    if (error.message?.includes('JWT_SECRET')) {
      return NextResponse.json({ error: 'Authentication service configuration error.' }, { status: 500 });
    }
    return NextResponse.json({ error: 'Internal server error. Please try again.' }, { status: 500 });
  }
}
