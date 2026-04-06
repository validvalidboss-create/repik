import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";

type Slot = { start: string; end: string };

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id: tutorId } = await params;
    const { searchParams } = new URL(req.url);
    const weekStartStr = searchParams.get("weekStart");
    const tz = searchParams.get("tz") || "UTC";
    const durationParam = searchParams.get("duration");

    const tutor = await prisma.tutor.findFirst({
      where: { OR: [{ id: tutorId }, { userId: tutorId }] },
      include: { availability: true },
    });

    if (!tutor) {
      if (process.env.NODE_ENV !== "production") {
        const weekStart = weekStartStr ? new Date(weekStartStr) : startOfWeek(new Date());
        const duration = Math.max(15, parseInt(durationParam || "50", 10));
        const demoWindows = [
          { weekday: 1, startMin: 10 * 60, endMin: 18 * 60 },
          { weekday: 2, startMin: 10 * 60, endMin: 18 * 60 },
          { weekday: 3, startMin: 10 * 60, endMin: 18 * 60 },
          { weekday: 4, startMin: 10 * 60, endMin: 18 * 60 },
          { weekday: 5, startMin: 10 * 60, endMin: 18 * 60 },
        ];
        const slotsByDay: Record<number, Slot[]> = {};
        for (let i = 0; i < 7; i++) {
          const dayDate = addDays(weekStart, i);
          const weekday = dayDate.getUTCDay();
          const dayWindows = demoWindows.filter((a) => a.weekday === weekday);
          const daySlots: Slot[] = [];
          for (const w of dayWindows) {
            for (let m = w.startMin; m + duration <= w.endMin; m += duration) {
              const start = toISOAtMinutes(dayDate, m, tz);
              const end = toISOAtMinutes(dayDate, m + duration, tz);
              daySlots.push({ start, end });
            }
          }
          slotsByDay[weekday] = daySlots;
        }
        return Response.json({
          durationMinutes: duration,
          timezone: tz,
          weekStart: weekStart.toISOString(),
          slotsByDay,
          __demo: true,
        });
      }
      return Response.json({ slots: [] });
    }

    const duration = Math.max(15, parseInt(durationParam || "50", 10));
    const weekStart = weekStartStr ? new Date(weekStartStr) : startOfWeek(new Date());

    const slotsByDay: Record<number, Slot[]> = {};
    const hasAvailability = tutor.availability && tutor.availability.length > 0;
    const demoWindows = [
      { weekday: 1, startMin: 10 * 60, endMin: 18 * 60 },
      { weekday: 2, startMin: 10 * 60, endMin: 18 * 60 },
      { weekday: 3, startMin: 10 * 60, endMin: 18 * 60 },
      { weekday: 4, startMin: 10 * 60, endMin: 18 * 60 },
      { weekday: 5, startMin: 10 * 60, endMin: 18 * 60 },
    ];

    for (let i = 0; i < 7; i++) {
      const dayDate = addDays(weekStart, i);
      const weekday = dayDate.getUTCDay(); // 0..6
      const dayWindows = (hasAvailability ? tutor.availability : (process.env.NODE_ENV !== "production" ? demoWindows : []))
        .filter((a) => a.weekday === weekday);
      const daySlots: Slot[] = [];
      for (const w of dayWindows) {
        for (let m = w.startMin; m + duration <= w.endMin; m += duration) {
          const start = toISOAtMinutes(dayDate, m, tz);
          const end = toISOAtMinutes(dayDate, m + duration, tz);
          daySlots.push({ start, end });
        }
      }
      slotsByDay[weekday] = daySlots;
    }

    return Response.json({
      durationMinutes: duration,
      timezone: tz,
      weekStart: weekStart.toISOString(),
      slotsByDay,
    });
  } catch (e: any) {
    return Response.json({ error: e?.message || "Server error" }, { status: 500 });
  }
}

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id: tutorIdParam } = await params;
    const body = await req.json().catch(() => null);
    if (!body) return Response.json({ error: "Invalid JSON" }, { status: 400 });

    const { userId, windows, preset, timezone } = (body as any) ?? {};

    const tutor = await prisma.tutor.findFirst({ where: { OR: [{ id: tutorIdParam }, { userId: tutorIdParam }] } });
    if (!tutor) return Response.json({ error: "Tutor not found" }, { status: 404 });

    if (process.env.NODE_ENV === "production") {
      if (!userId || userId !== tutor.userId) {
        return Response.json({ error: "Forbidden" }, { status: 403 });
      }
    }

    let toSet: Array<{ weekday: number; startMin: number; endMin: number; timezone: string }>;
    if (preset === "default") {
      const tz = typeof timezone === "string" && timezone ? timezone : "Europe/Kyiv";
      toSet = [1, 2, 3, 4, 5].map((d) => ({ weekday: d, startMin: 10 * 60, endMin: 18 * 60, timezone: tz }));
    } else if (Array.isArray(windows)) {
      toSet = windows.map((w: any) => ({
        weekday: Number(w.weekday),
        startMin: Number(w.startMin),
        endMin: Number(w.endMin),
        timezone: String(w.timezone || timezone || "Europe/Kyiv"),
      }));
    } else {
      return Response.json({ error: "Provide `preset` or `windows[]`" }, { status: 400 });
    }

    toSet = toSet.filter((w) => Number.isInteger(w.weekday) && w.weekday >= 0 && w.weekday <= 6 && w.startMin >= 0 && w.endMin > w.startMin && w.endMin <= 24 * 60);
    if (!toSet.length) return Response.json({ error: "No valid windows" }, { status: 400 });

    await prisma.$transaction([
      prisma.availability.deleteMany({ where: { tutorId: tutor.id } }),
      prisma.availability.createMany({
        data: toSet.map((w) => ({ tutorId: tutor.id, weekday: w.weekday, startMin: w.startMin, endMin: w.endMin, timezone: w.timezone })),
      }),
    ]);

    const updated = await prisma.availability.findMany({ where: { tutorId: tutor.id }, orderBy: [{ weekday: "asc" }, { startMin: "asc" }] });
    return Response.json({ ok: true, count: updated.length, windows: updated });
  } catch (e: any) {
    return Response.json({ error: e?.message || "Server error" }, { status: 500 });
  }
}

function startOfWeek(d: Date) {
  const day = d.getUTCDay(); // 0..6, Sun=0
  const diff = (day + 6) % 7; // Monday as start
  const res = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
  res.setUTCDate(res.getUTCDate() - diff);
  return res;
}

function addDays(d: Date, days: number) {
  const res = new Date(d.getTime());
  res.setUTCDate(res.getUTCDate() + days);
  return res;
}

function toISOAtMinutes(dayDate: Date, minutesFromMidnight: number, tz: string) {
  // Simplified: construct time in UTC based on dayDate at 00:00 UTC + minutes.
  // For MVP, we ignore tz shift here; future: use date-fns-tz to map tutor/learner TZ.
  const res = new Date(Date.UTC(dayDate.getUTCFullYear(), dayDate.getUTCMonth(), dayDate.getUTCDate(), 0, 0, 0));
  res.setUTCMinutes(res.getUTCMinutes() + minutesFromMidnight);
  return res.toISOString();
}
