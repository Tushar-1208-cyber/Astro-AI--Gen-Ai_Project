import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getAuthenticatedUser } from "@/lib/auth";
import { calendarRepo } from "@/lib/db-repo";
import { validateSameOrigin } from "@/lib/security";

const CalendarEventSchema = z.object({
  title: z.string().trim().min(1, "Event title is required").max(200),
  date: z.string().or(z.date()),
  type: z.enum(["Lesson", "Deadline", "Event", "Holiday"]).default("Event"),
  description: z.string().optional().default(""),
});

const EventDeleteSchema = z.object({
  id: z.string().min(1, "Event ID is required"),
});

export async function GET(req: NextRequest) {
  const user = await getAuthenticatedUser();
  if (!user) {
    return NextResponse.json({ error: "User not authenticated." }, { status: 401 });
  }

  const { searchParams } = new URL(req.url);
  const type = searchParams.get("type") || undefined;
  const startDate = searchParams.get("startDate") ? new Date(searchParams.get("startDate")!) : undefined;
  const endDate = searchParams.get("endDate") ? new Date(searchParams.get("endDate")!) : undefined;
  const page = searchParams.get("page") ? Number(searchParams.get("page")) : undefined;
  const limit = searchParams.get("limit") ? Number(searchParams.get("limit")) : undefined;

  const events = await calendarRepo.getEvents(user.userId, { type, startDate, endDate, page, limit });
  return NextResponse.json({ events });
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
    const validation = CalendarEventSchema.safeParse(body);
    if (!validation.success) {
      return NextResponse.json({ error: validation.error.errors[0]?.message || "Invalid event data" }, { status: 400 });
    }

    const created = await calendarRepo.addEvent(user.userId, {
      ...validation.data,
      date: new Date(validation.data.date),
    });
    const events = await calendarRepo.getEvents(user.userId);
    return NextResponse.json({ events, created }, { status: 201 });
  } catch (error: any) {
    return NextResponse.json({ error: error?.message || "Failed to create event" }, { status: 500 });
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
    const validation = EventDeleteSchema.safeParse(body);
    if (!validation.success) {
      return NextResponse.json({ error: "Event ID is required" }, { status: 400 });
    }

    const deleted = await calendarRepo.deleteEvent(user.userId, validation.data.id);
    if (!deleted) {
      return NextResponse.json({ error: "Calendar event not found or access denied" }, { status: 404 });
    }

    const events = await calendarRepo.getEvents(user.userId);
    return NextResponse.json({ events, success: true });
  } catch (error: any) {
    return NextResponse.json({ error: error?.message || "Failed to delete event" }, { status: 500 });
  }
}
