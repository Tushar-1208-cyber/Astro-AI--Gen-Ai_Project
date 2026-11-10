import { NextRequest, NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';
import dbConnect from '@/lib/db';
import { getAuthenticatedUser } from '@/lib/auth';
import { getStoredImageMeta } from '@/lib/storage';
import Student from '@/models/Student';
import Attendance from '@/models/Attendance';

export async function GET(
  req: NextRequest,
  context: { params: Promise<{ path?: string[] }> }
) {
  // 1. Authenticate requesting user strictly using verified JWT
  const user = await getAuthenticatedUser();
  if (!user || !user.userId) {
    return NextResponse.json({ error: 'Unauthorized image access' }, { status: 401 });
  }

  // 2. Parse and validate requested category and filename
  const { path: pathSegments } = await context.params;
  if (!pathSegments || pathSegments.length < 2) {
    return NextResponse.json({ error: 'Invalid file path' }, { status: 400 });
  }

  const category = pathSegments[0].toLowerCase().trim();
  const rawFilename = pathSegments.slice(1).join('/');

  // Reject invalid categories immediately
  if (category !== 'students' && category !== 'attendance') {
    return NextResponse.json({ error: 'Image not found' }, { status: 404 });
  }

  // Sanitize filename and prevent directory traversal
  const safeFilename = path.basename(rawFilename);
  if (!safeFilename || safeFilename !== rawFilename || rawFilename.includes('..') || rawFilename.includes('\\')) {
    return NextResponse.json({ error: 'Invalid file path' }, { status: 400 });
  }

  // 3. Verify file exists on physical disk within dedicated storage directory
  const meta = getStoredImageMeta(category, safeFilename);
  if (!meta) {
    return NextResponse.json({ error: 'Image not found' }, { status: 404 });
  }

  // 4. Verify Resource Ownership in MongoDB
  // The authenticated user must own the Student or Attendance record referencing this exact file.
  try {
    await dbConnect();
    const exactUrl = `/api/storage/${category}/${safeFilename}`;
    let isOwned = false;

    if (category === 'students') {
      const ownerCheck = await Student.exists({
        userId: user.userId,
        $or: [
          { photoUrl: exactUrl },
          { photoDataUri: exactUrl },
        ],
      });
      isOwned = !!ownerCheck;
    } else if (category === 'attendance') {
      const ownerCheck = await Attendance.exists({
        userId: user.userId,
        $or: [
          { photoUrl: exactUrl },
          { photoDataUri: exactUrl },
        ],
      });
      isOwned = !!ownerCheck;
    }

    if (!isOwned) {
      // Return 404 Not Found to prevent information disclosure (attacker cannot probe file existence)
      return NextResponse.json({ error: 'Image not found' }, { status: 404 });
    }

    // 5. Stream the verified file
    const fileBuffer = await fs.promises.readFile(meta.filePath);
    return new NextResponse(fileBuffer, {
      status: 200,
      headers: {
        'Content-Type': meta.mimeType,
        'Content-Length': meta.size.toString(),
        'Cache-Control': 'private, no-store',
        'X-Content-Type-Options': 'nosniff',
      },
    });
  } catch (error) {
    // Fail-secure: never reveal internal server paths
    return NextResponse.json({ error: 'Error reading file' }, { status: 500 });
  }
}
