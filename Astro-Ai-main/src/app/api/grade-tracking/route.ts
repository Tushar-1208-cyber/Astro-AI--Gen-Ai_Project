import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getAuthenticatedUser } from "@/lib/auth";
import { gradeRepo } from "@/lib/db-repo";
import { validateSameOrigin } from "@/lib/security";

const GradeEntrySchema = z.object({
  studentName: z.string().trim().min(1, "Student name is required").max(100),
  subject: z.string().trim().min(1, "Subject is required").max(100),
  grade: z.number().min(0, "Grade cannot be negative").max(100, "Grade cannot exceed 100"),
  className: z.string().trim().min(1, "Class is required").max(50),
  date: z.string().or(z.date()).optional().default(() => new Date()),
});

const GradeUpdateSchema = z.object({
  id: z.string().min(1, "Grade entry ID is required"),
  studentName: z.string().trim().min(1).max(100).optional(),
  subject: z.string().trim().min(1).max(100).optional(),
  grade: z.number().min(0).max(100).optional(),
  className: z.string().trim().min(1).max(50).optional(),
  date: z.string().or(z.date()).optional(),
});

const GradeDeleteSchema = z.object({
  id: z.string().min(1, "Grade entry ID is required"),
});

export async function GET(req: NextRequest) {
  const user = await getAuthenticatedUser();
  if (!user) {
    return NextResponse.json({ error: "User not authenticated." }, { status: 401 });
  }

  const { searchParams } = new URL(req.url);
  const className = searchParams.get("className") || undefined;
  const subject = searchParams.get("subject") || undefined;
  const search = searchParams.get("search") || undefined;
  const sort = searchParams.get("sort") || undefined;
  const page = searchParams.get("page") ? Number(searchParams.get("page")) : undefined;
  const limit = searchParams.get("limit") ? Number(searchParams.get("limit")) : undefined;

  const grades = await gradeRepo.getGrades(user.userId, { className, subject, search, sort, page, limit });
  return NextResponse.json({ grades });
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
    const validation = GradeEntrySchema.safeParse(body);
    if (!validation.success) {
      return NextResponse.json({ error: validation.error.errors[0]?.message || "Invalid grade data" }, { status: 400 });
    }

    const created = await gradeRepo.addGrade(user.userId, validation.data);
    const grades = await gradeRepo.getGrades(user.userId);
    return NextResponse.json({ grades, created }, { status: 201 });
  } catch (error: any) {
    return NextResponse.json({ error: error?.message || "Failed to add grade" }, { status: 500 });
  }
}

export async function PATCH(req: NextRequest) {
  if (!validateSameOrigin(req)) {
    return NextResponse.json({ error: "Invalid request origin" }, { status: 403 });
  }

  const user = await getAuthenticatedUser();
  if (!user) {
    return NextResponse.json({ error: "User not authenticated." }, { status: 401 });
  }

  try {
    const body = await req.json();
    const validation = GradeUpdateSchema.safeParse(body);
    if (!validation.success) {
      return NextResponse.json({ error: validation.error.errors[0]?.message || "Invalid update data" }, { status: 400 });
    }

    const updated = await gradeRepo.updateGrade(user.userId, validation.data.id, validation.data);
    if (!updated) {
      return NextResponse.json({ error: "Grade entry not found or access denied" }, { status: 404 });
    }

    const grades = await gradeRepo.getGrades(user.userId);
    return NextResponse.json({ grades, updated });
  } catch (error: any) {
    return NextResponse.json({ error: error?.message || "Failed to update grade" }, { status: 500 });
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
    const validation = GradeDeleteSchema.safeParse(body);
    if (!validation.success) {
      return NextResponse.json({ error: "Grade entry ID is required" }, { status: 400 });
    }

    const deleted = await gradeRepo.deleteGrade(user.userId, validation.data.id);
    if (!deleted) {
      return NextResponse.json({ error: "Grade entry not found or access denied" }, { status: 404 });
    }

    const grades = await gradeRepo.getGrades(user.userId);
    return NextResponse.json({ grades, success: true });
  } catch (error: any) {
    return NextResponse.json({ error: error?.message || "Failed to delete grade" }, { status: 500 });
  }
}
