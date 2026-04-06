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
  try {
    const session = await auth();
    const user = session?.user as any;
    if (!user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const { searchParams } = new URL(req.url);
    const weekStartParam = String(searchParams.get("weekStart") || "");
    const weekStart = weekStartParam ? new Date(weekStartParam) : startOfWeekUTC(new Date());
    if (Number.isNaN(weekStart.getTime())) return NextResponse.json({ error: "Invalid weekStart" }, { status: 400 });

    const weekEnd = addDaysUTC(weekStart, 7);

    const bookings = await prisma.booking.findMany({
      where: {
        studentId: String(user.id),
        status: {
          in: ["PENDING", "CONFIRMED", "COMPLETED", "CANCELED", "REFUNDED", "DISPUTED", "MISSED_TRIAL"] as any,
        },
        startsAt: { gte: weekStart, lt: weekEnd },
      },
      orderBy: { startsAt: "asc" },
      select: {
        id: true,
        status: true,
        startsAt: true,
        endsAt: true,
        durationMinutes: true,
        tutor: {
          select: {
            id: true,
            rateCents: true,
            headline: true,
            subjects: true,
            media: true,
            user: { select: { id: true, name: true, email: true, image: true } },
          },
        },
      },
    });

    return NextResponse.json({ ok: true, weekStart: weekStart.toISOString(), weekEnd: weekEnd.toISOString(), bookings });
  } catch (e: any) {
    const msg = String(e?.message || "");
    const looksLikeDbDown = /ECONNREFUSED|ETIMEDOUT|ENOTFOUND|P1001|P1002/i.test(msg);
    return NextResponse.json(
      { error: looksLikeDbDown ? "Database unavailable" : "Failed to load schedule" },
      { status: looksLikeDbDown ? 503 : 500 },
    );
  }
}
