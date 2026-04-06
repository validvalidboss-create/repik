import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";

export async function GET(_req: NextRequest) {
  const session = await auth();
  const user = session?.user as any;
  if (!user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const tutor = await prisma.tutor.findUnique({ where: { userId: String(user.id) }, select: { id: true } });
  if (!tutor?.id) return NextResponse.json({ ok: true, count: 0, nextStartsAt: null });

  const now = new Date();

  const [count, next] = await Promise.all([
    prisma.booking.count({
      where: {
        tutorId: tutor.id,
        status: { in: ["CONFIRMED" as any, "PENDING" as any] },
        startsAt: { gte: now },
      },
    }),
    prisma.booking.findFirst({
      where: {
        tutorId: tutor.id,
        status: { in: ["CONFIRMED" as any, "PENDING" as any] },
        startsAt: { gte: now },
      },
      orderBy: { startsAt: "asc" },
      select: { startsAt: true },
    }),
  ]);

  return NextResponse.json({ ok: true, count, nextStartsAt: next?.startsAt ? next.startsAt.toISOString() : null });
}
