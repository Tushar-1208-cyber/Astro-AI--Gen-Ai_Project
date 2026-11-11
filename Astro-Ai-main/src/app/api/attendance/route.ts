import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getAuthenticatedUser } from "@/lib/auth";
import { recognizeStudents } from "@/ai/flows/recognize-students";
import { studentRepo, attendanceRepo } from "@/lib/db-repo";
import { validateSameOrigin } from "@/lib/security";

const AttendanceScanSchema = z.object({
  action: z.literal("scan").optional(),
  photoDataUri: z.string().min(10, "Photo data is required"),
  presentStudents: z.undefined({
    invalid_type_error: "Scan requests must not include presentStudents",
  }),
  presentStudentIds: z.undefined({
    invalid_type_error: "Scan requests must not include presentStudentIds",
  }),
});

const AttendanceSubmitSchema = z
  .object({
    action: z.literal("submit").optional(),
    date: z.string().or(z.date()).optional().default(() => new Date()),
    presentStudents: z.array(z.string()).optional(),
    presentStudentIds: z.array(z.string()).optional(),
    photoDataUri: z.string().optional(),
  })
  .refine(
    (data) => {
      const hasNames =
        Array.isArray(data.presentStudents) &&
        data.presentStudents.some((s) => typeof s === "string" && s.trim().length > 0);
      const hasIds =
        Array.isArray(data.presentStudentIds) &&
        data.presentStudentIds.some((id) => typeof id === "string" && id.trim().length > 0);
      return hasNames || hasIds;
    },
    {
      message: "At least one valid student ID or name must be marked present",
      path: ["presentStudentIds"],
    }
  );

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

    const hasPhoto = typeof body?.photoDataUri === "string" && body.photoDataUri.trim().length > 0;
    const hasPresentStudents = Array.isArray(body?.presentStudents);
    const hasPresentStudentIds = Array.isArray(body?.presentStudentIds);
    const isScanAction = body?.action === "scan";
    const isSubmitAction = body?.action === "submit";

    // 1. Explicitly detect malformed mixed scan and direct submission payloads
    if (isScanAction && (hasPresentStudents || hasPresentStudentIds)) {
      return NextResponse.json(
        {
          success: false,
          error: "Malformed mixed scan and direct submission payload: Scan requests cannot include attendance identity lists.",
        },
        { status: 400 }
      );
    }

    if (isSubmitAction && !hasPresentStudents && !hasPresentStudentIds) {
      return NextResponse.json(
        {
          success: false,
          error: "Malformed attendance submission: At least one student identity must be provided.",
        },
        { status: 400 }
      );
    }

    // 2. Classify: Direct attendance submission takes priority when student identities or submit action are present
    const isDirectSubmission =
      hasPresentStudentIds ||
      hasPresentStudents ||
      isSubmitAction;

    if (isDirectSubmission) {
      const validation = AttendanceSubmitSchema.safeParse(body);
      if (!validation.success) {
        return NextResponse.json(
          {
            success: false,
            error: validation.error.errors[0]?.message || "Invalid attendance data",
          },
          { status: 400 }
        );
      }

      const created = await attendanceRepo.addAttendance(user.userId, {
        date: new Date(validation.data.date),
        presentStudentIds: validation.data.presentStudentIds,
        presentStudents: validation.data.presentStudents,
        photoDataUri: validation.data.photoDataUri,
      });

      const history = await attendanceRepo.getAttendance(user.userId);
      return NextResponse.json({ success: true, created, history }, { status: 201 });
    }

    // 3. Classify: AI Face Recognition Scan (must have photo and no identity lists)
    if (hasPhoto && !hasPresentStudents && !hasPresentStudentIds) {
      const validation = AttendanceScanSchema.safeParse(body);
      if (!validation.success) {
        return NextResponse.json(
          {
            success: false,
            error: validation.error.errors[0]?.message || "Invalid photo payload",
          },
          { status: 400 }
        );
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

      const rawRecognized = (result && Array.isArray(result.presentStudents)) ? result.presentStudents : [];
      const validated = await attendanceRepo.validateAndNormalizeAiRecognition(user.userId, rawRecognized);

      return NextResponse.json({
        success: true,
        data: {
          presentStudents: validated.canonicalDisplayNames,
          presentStudentIds: validated.canonicalStudentIds,
          unresolvedNames: validated.unresolvedNames,
        },
      });
    }

    // 4. Neither valid direct submission nor valid scan request
    return NextResponse.json(
      {
        success: false,
        error: "Invalid request payload: must provide attendance identities for submission or photo data for scan.",
      },
      { status: 400 }
    );
  } catch (error: any) {
    const isClientError =
      error?.message?.includes('not enrolled in your roster') ||
      error?.message?.includes('not in this teacher\'s active roster') ||
      error?.message?.includes('Ambiguous student name') ||
      error?.message?.includes('Ambiguous student identity') ||
      error?.message?.includes('Conflicting student identity') ||
      error?.message?.includes('Duplicate student name') ||
      error?.message?.includes('Invalid attendance submission') ||
      error?.message?.includes('At least one');
    return NextResponse.json(
      { success: false, error: error?.message || "Recognition / Attendance failed." },
      { status: isClientError ? 400 : 500 }
    );
  }
}
