import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

function startOfWeek(d: Date) {
  const date = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
  const day = date.getUTCDay(); // 0..6 Sun=0
  const diff = (day + 6) % 7; // make Monday=0
  date.setUTCDate(date.getUTCDate() - diff);
  return date;
}

function addMinutes(date: Date, minutes: number) {
  return new Date(date.getTime() + minutes * 60000);
}

function roundUpToStep(min: number, step: number) {
  return Math.ceil(min / step) * step;
}

function roundDownToStep(min: number, step: number) {
  return Math.floor(min / step) * step;
}

function getYMDInTz(timeZone: string, date: Date) {
  const dtf = new Intl.DateTimeFormat("en-US", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });
  const parts = dtf.formatToParts(date);
  const get = (type: string) => Number(parts.find((p) => p.type === type)?.value || 0);
  return { y: get("year"), mo: get("month"), d: get("day") };
}

function getTimezoneOffsetMinutes(timeZone: string, date: Date) {
  try {
    const dtf = new Intl.DateTimeFormat("en-US", {
      timeZone,
      hour12: false,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
    });
    const parts = dtf.formatToParts(date);
    const get = (type: string) => Number(parts.find((p) => p.type === type)?.value || 0);
    const asUTC = Date.UTC(get("year"), get("month") - 1, get("day"), get("hour"), get("minute"), get("second"));
    return Math.round((asUTC - date.getTime()) / 60000);
  } catch {
    return 0;
  }
}

function toISOInTz(timeZone: string, y: number, mo: number, d: number, h: number, mi: number) {
  const guess = Date.UTC(y, mo - 1, d, h, mi, 0);
  const off = getTimezoneOffsetMinutes(timeZone, new Date(guess));
  return new Date(guess - off * 60000).toISOString();
}

function toISOAtMinutes(dayUTC: Date, minutes: number, timeZone: string) {
  const ymd = getYMDInTz(timeZone, dayUTC);
  const h = Math.floor(minutes / 60);
  const mi = minutes % 60;
  return toISOInTz(timeZone, ymd.y, ymd.mo, ymd.d, h, mi);
}

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const tutorId = searchParams.get("tutorId");
  const weekStartParam = searchParams.get("weekStart");
  const durationMin = Number(searchParams.get("durationMin") || 60);

  if (!tutorId) return NextResponse.json({ error: "tutorId required" }, { status: 400 });

  const weekStart = weekStartParam ? new Date(weekStartParam) : startOfWeek(new Date());
  if (Number.isNaN(weekStart.getTime())) return NextResponse.json({ error: "Invalid weekStart" }, { status: 400 });

  const weekEnd = addMinutes(weekStart, 7 * 24 * 60);

  const [availability, bookings] = await Promise.all([
    prisma.availability.findMany({ where: { tutorId }, orderBy: [{ weekday: 'asc' }, { startMin: 'asc' }] }),
    prisma.booking.findMany({
      where: {
        tutorId,
        status: { in: ["PENDING", "CONFIRMED", "COMPLETED"] },
        startsAt: { lt: weekEnd },
        endsAt: { gt: weekStart },
      },
      select: { startsAt: true, endsAt: true },
    }),
  ]);

  const tutorTz = String((availability as any[])?.[0]?.timezone || "UTC") || "UTC";

  // generate slots for each day by weekday
  const slots: { start: string; end: string }[] = [];
  for (let i = 0; i < 7; i++) {
    const day = addMinutes(weekStart, i * 24 * 60);
    const weekday = day.getUTCDay(); // 0..6
    const dayWindows = availability.filter((a) => a.weekday === weekday);
    for (const w of dayWindows) {
      const stepMin = 30;
      const startMin = roundUpToStep(Number(w.startMin || 0) || 0, stepMin);
      const endMin = roundDownToStep(Number(w.endMin || 0) || 0, stepMin);
      if (endMin <= startMin) continue;

      const windowStart = new Date(toISOAtMinutes(day, startMin, tutorTz));
      const windowEnd = new Date(toISOAtMinutes(day, endMin, tutorTz));

      for (let t = new Date(windowStart); addMinutes(t, durationMin) <= windowEnd; t = addMinutes(t, stepMin)) {
        const start = new Date(t);
        const end = addMinutes(start, durationMin);
        // exclude if overlaps bookings
        const overlaps = bookings.some((b) => !(end <= b.startsAt || start >= b.endsAt));
        if (!overlaps) slots.push({ start: start.toISOString(), end: end.toISOString() });
      }
    }
  }

  const booked = (bookings || []).map((b) => ({
    start: new Date(b.startsAt).toISOString(),
    end: new Date(b.endsAt).toISOString(),
  }));

  return NextResponse.json({ weekStart: weekStart.toISOString(), weekEnd: weekEnd.toISOString(), slots, booked });
}
