import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getAuthenticatedUser } from "@/lib/auth";
import { recognizeStudents } from "@/ai/flows/recognize-students";
import { studentRepo, attendanceRepo } from "@/lib/db-repo";
import { validateSameOrigin } from "@/lib/security";

const AttendanceScanSchema = z.object({
  photoDataUri: z.string().min(10, "Photo data is required"),
});

const AttendanceSubmitSchema = z.object({
  date: z.string().or(z.date()).optional().default(() => new Date()),
  presentStudents: z.array(z.string()).default([]),
  photoDataUri: z.string().optional(),
});

export async function GET(req: NextRequest) {
  const user = await getAuthenticatedUser();
  if (!user) {
    return NextResponse.json({ error: "User not authenticated." }, { status: 401 });
  }

  const { searchParams } = new URL(req.url);
  const page = searchParams.get("page") ? Number(searchParams.get("page")) : undefined;
  const limit = searchParams.get("limit") ? Number(searchParams.get("limit")) : undefined;

  const attendance = await attendanceRepo.getAttendance(user.userId, { page, limit });
  return NextResponse.json({ attendance });
}

export async function POST(req: NextRequest) {
  if (!validateSameOrigin(req)) {
    return NextResponse.json({ success: false, error: "Invalid request origin" }, { status: 403 });
  }

  const user = await getAuthenticatedUser();
  if (!user) {
    return NextResponse.json({ success: false, error: "User not authenticated." }, { status: 401 });
  }

  try {
    const body = await req.json();

    // Check if this is an AI face recognition request or an attendance submission
    if (body.photoDataUri && !body.presentStudents) {
      const validation = AttendanceScanSchema.safeParse(body);
      if (!validation.success) {
        return NextResponse.json({ success: false, error: "Invalid photo payload" }, { status: 400 });
      }

      const students = await studentRepo.getStudents(user.userId);
      const studentRoster = students.map((s) => ({
        id: s.id || s._id.toString(),
        uid: s.userId,
        name: s.name,
        photoDataUri: s.photoDataUri || s.photoUrl || '',
      }));

      const result = await recognizeStudents({
        photoDataUri: validation.data.photoDataUri,
        studentRoster,
      });
      return NextResponse.json({ success: true, data: result });
    }

    // Direct attendance submission
    const validation = AttendanceSubmitSchema.safeParse(body);
    if (!validation.success) {
      return NextResponse.json({ success: false, error: "Invalid attendance data" }, { status: 400 });
    }

    const created = await attendanceRepo.addAttendance(user.userId, {
      date: new Date(validation.data.date),
      presentStudents: validation.data.presentStudents,
      photoDataUri: validation.data.photoDataUri,
    });

    const history = await attendanceRepo.getAttendance(user.userId);
    return NextResponse.json({ success: true, created, history }, { status: 201 });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error?.message || "Recognition / Attendance failed." }, { status: 500 });
  }
}
