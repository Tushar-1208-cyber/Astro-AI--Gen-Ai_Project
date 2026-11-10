import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getAuthenticatedUser } from "@/lib/auth";
import { studentRepo } from "@/lib/db-repo";
import { validateSameOrigin } from "@/lib/security";

const StudentCreateSchema = z.object({
  name: z.string().trim().min(1, "Student name is required").max(100),
  photoDataUri: z.string().optional().default(""),
});

const StudentUpdateSchema = z.object({
  id: z.string().min(1, "Student ID is required"),
  name: z.string().trim().min(1).max(100).optional(),
  photoDataUri: z.string().optional(),
});

const StudentDeleteSchema = z.object({
  id: z.string().min(1, "Student ID is required"),
});

export async function GET(req: NextRequest) {
  const user = await getAuthenticatedUser();
  if (!user) {
    return NextResponse.json({ error: "User not authenticated." }, { status: 401 });
  }

  const { searchParams } = new URL(req.url);
  const search = searchParams.get("search") || undefined;
  const page = searchParams.get("page") ? Number(searchParams.get("page")) : undefined;
  const limit = searchParams.get("limit") ? Number(searchParams.get("limit")) : undefined;
  const sort = searchParams.get("sort") || undefined;

  const students = await studentRepo.getStudents(user.userId, { search, page, limit, sort });
  return NextResponse.json({ students });
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
    const validation = StudentCreateSchema.safeParse(body);
    if (!validation.success) {
      return NextResponse.json({ error: validation.error.errors[0]?.message || "Invalid student data" }, { status: 400 });
    }

    const created = await studentRepo.addStudent(user.userId, validation.data);
    const students = await studentRepo.getStudents(user.userId);
    return NextResponse.json({ students, created }, { status: 201 });
  } catch (error: any) {
    return NextResponse.json({ error: error?.message || "Failed to create student" }, { status: 500 });
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
    const validation = StudentUpdateSchema.safeParse(body);
    if (!validation.success) {
      return NextResponse.json({ error: validation.error.errors[0]?.message || "Invalid update data" }, { status: 400 });
    }

    const updated = await studentRepo.updateStudent(user.userId, validation.data.id, validation.data);
    if (!updated) {
      return NextResponse.json({ error: "Student not found or access denied" }, { status: 404 });
    }

    const students = await studentRepo.getStudents(user.userId);
    return NextResponse.json({ students, updated });
  } catch (error: any) {
    return NextResponse.json({ error: error?.message || "Failed to update student" }, { status: 500 });
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
    const validation = StudentDeleteSchema.safeParse(body);
    if (!validation.success) {
      return NextResponse.json({ error: "Student ID is required" }, { status: 400 });
    }

    const deleted = await studentRepo.deleteStudent(user.userId, validation.data.id);
    if (!deleted) {
      return NextResponse.json({ error: "Student not found or access denied" }, { status: 404 });
    }

    const students = await studentRepo.getStudents(user.userId);
    return NextResponse.json({ students, success: true });
  } catch (error: any) {
    return NextResponse.json({ error: error?.message || "Failed to delete student" }, { status: 500 });
  }
}
