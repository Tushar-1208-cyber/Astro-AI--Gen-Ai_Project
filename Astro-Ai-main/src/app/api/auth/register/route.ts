import { NextRequest, NextResponse } from 'next/server';
import bcrypt from 'bcryptjs';
import { z } from 'zod';
import dbConnect from '@/lib/db';
import User from '@/models/User';
import { checkRateLimit } from '@/lib/rate-limiter';
import { getClientIp, validateSameOrigin } from '@/lib/security';

const RegisterSchema = z.object({
  name: z.string().trim().max(50, 'Name is too long').optional(),
  email: z.string().trim().email('Please enter a valid email address').toLowerCase(),
  password: z.string().min(6, 'Password must be at least 6 characters long').max(100, 'Password is too long'),
});

export async function POST(req: NextRequest) {
  try {
    if (!validateSameOrigin(req)) {
      return NextResponse.json({ error: 'Invalid request origin' }, { status: 403 });
    }

    const clientIp = getClientIp(req);
    const rateLimit = await checkRateLimit(`register:${clientIp}`, 5, 3600); // 5 per hour
    if (!rateLimit.success) {
      return NextResponse.json(
        { error: 'Too many registration attempts. Please try again later.' },
        { status: 429 }
      );
    }

    let body;
    try {
      body = await req.json();
    } catch {
      return NextResponse.json({ error: 'Malformed JSON payload' }, { status: 400 });
    }

    const validation = RegisterSchema.safeParse(body);
    if (!validation.success) {
      const firstError = validation.error.errors[0]?.message || 'Invalid input data';
      return NextResponse.json({ error: firstError }, { status: 400 });
    }

    const { name, email, password } = validation.data;
    const resolvedName = name && name.trim().length > 0 ? name.trim() : email.split('@')[0];

    await dbConnect();

    // Check for duplicate account
    const existingUser = await User.findOne({ email });
    if (existingUser) {
      return NextResponse.json(
        { error: 'An account with this email address already exists.' },
        { status: 409 }
      );
    }

    // Hash password with bcrypt (salt rounds = 10)
    const hashedPassword = await bcrypt.hash(password, 10);

    const newUser = await User.create({
      name: resolvedName,
      email,
      password: hashedPassword,
      role: 'teacher',
    });

    return NextResponse.json(
      {
        message: 'Registration successful! Please log in.',
        user: {
          id: newUser._id.toString(),
          email: newUser.email,
          name: newUser.name,
        },
      },
      { status: 201 }
    );
  } catch (error: any) {
    console.error('[Register] Internal error:', error);
    return NextResponse.json({ error: 'Internal server error. Please try again.' }, { status: 500 });
  }
}
