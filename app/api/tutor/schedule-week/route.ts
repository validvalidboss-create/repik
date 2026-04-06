import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";

function startOfWeekUTC(d: Date) {
  const date = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
  const day = date.getUTCDay();
  const diff = (day + 6) % 7;
  date.setUTCDate(date.getUTCDate() - diff);
  return date;
}

function addDaysUTC(d: Date, days: number) {
  const copy = new Date(d);
  copy.setUTCDate(copy.getUTCDate() + days);
  return copy;
}

export async function GET(req: NextRequest) {
  const session = await auth();
  const user = session?.user as any;
  if (!user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const tutor = await prisma.tutor.findUnique({ where: { userId: String(user.id) } });
  if (!tutor?.id) return NextResponse.json({ error: "Tutor not found" }, { status: 404 });

  const { searchParams } = new URL(req.url);
  const weekStartParam = String(searchParams.get("weekStart") || "");
  const weekStart = weekStartParam ? new Date(weekStartParam) : startOfWeekUTC(new Date());
  if (Number.isNaN(weekStart.getTime())) return NextResponse.json({ error: "Invalid weekStart" }, { status: 400 });

  const weekEnd = addDaysUTC(weekStart, 7);

  const bookings = await prisma.booking.findMany({
    where: {
      tutorId: tutor.id,
      status: { in: ["PENDING", "CONFIRMED"] as any },
      startsAt: { gte: weekStart, lt: weekEnd },
    },
    orderBy: { startsAt: "asc" },
    select: {
      id: true,
      status: true,
      startsAt: true,
      endsAt: true,
      durationMinutes: true,
      student: { select: { id: true, name: true, email: true, image: true } },
    },
  });

  return NextResponse.json({ ok: true, weekStart: weekStart.toISOString(), weekEnd: weekEnd.toISOString(), bookings });
}
