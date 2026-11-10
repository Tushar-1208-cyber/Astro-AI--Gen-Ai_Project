import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getAuthenticatedUser } from "@/lib/auth";
import { recordingRepo } from "@/lib/db-repo";
import { validateSameOrigin } from "@/lib/security";

const RecordingSchema = z.object({
  title: z.string().trim().min(1, "Recording title is required").max(200),
  videoUrl: z.string().min(1, "Video URL/data is required"),
  thumbnailUrl: z.string().optional().default(""),
  duration: z.string().optional().default("0:00"),
});

const RecordingDeleteSchema = z.object({
  id: z.string().min(1, "Recording ID is required"),
});

export async function GET(req: NextRequest) {
  const user = await getAuthenticatedUser();
  if (!user) {
    return NextResponse.json({ error: "User not authenticated." }, { status: 401 });
  }

  const { searchParams } = new URL(req.url);
  const page = searchParams.get("page") ? Number(searchParams.get("page")) : undefined;
  const limit = searchParams.get("limit") ? Number(searchParams.get("limit")) : undefined;

  const recordings = await recordingRepo.getRecordings(user.userId, { page, limit });
  return NextResponse.json({ recordings });
}

export async function POST(req: NextRequest) {
  if (!validateSameOrigin(req)) {
    return NextResponse.json({ error: "Invalid request origin" }, { status: 403 });
  }

  const user = await getAuthenticatedUser();
  if (!user) {
    return NextResponse.json({ error: "User not authenticated." }, { status: 401 });
  }

  try {
    const body = await req.json();
    const validation = RecordingSchema.safeParse(body);
    if (!validation.success) {
      return NextResponse.json({ error: validation.error.errors[0]?.message || "Invalid recording data" }, { status: 400 });
    }

    const created = await recordingRepo.addRecording(user.userId, validation.data);
    const recordings = await recordingRepo.getRecordings(user.userId);
    return NextResponse.json({ recordings, created }, { status: 201 });
  } catch (error: any) {
    return NextResponse.json({ error: error?.message || "Failed to save recording" }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest) {
  if (!validateSameOrigin(req)) {
    return NextResponse.json({ error: "Invalid request origin" }, { status: 403 });
  }

  const user = await getAuthenticatedUser();
  if (!user) {
    return NextResponse.json({ error: "User not authenticated." }, { status: 401 });
  }

  try {
    const body = await req.json();
    const validation = RecordingDeleteSchema.safeParse(body);
    if (!validation.success) {
      return NextResponse.json({ error: "Recording ID is required" }, { status: 400 });
    }

    const deleted = await recordingRepo.deleteRecording(user.userId, validation.data.id);
    if (!deleted) {
      return NextResponse.json({ error: "Class recording not found or access denied" }, { status: 404 });
    }

    const recordings = await recordingRepo.getRecordings(user.userId);
    return NextResponse.json({ recordings, success: true });
  } catch (error: any) {
    return NextResponse.json({ error: error?.message || "Failed to delete recording" }, { status: 500 });
  }
}
