import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  const session = await auth();
  const user = session?.user as any;
  if (!user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const body = await req.json().catch(() => null);
  const tutorId = String(body?.tutorId || "");
  if (!tutorId) return NextResponse.json({ error: "tutorId required" }, { status: 400 });

  const tutor = await prisma.tutor.findUnique({ where: { id: tutorId }, include: { user: true } });
  if (!tutor) return NextResponse.json({ error: "Tutor not found" }, { status: 404 });

  // Try to find an existing recent pending booking to reuse chat
  const existing = await prisma.booking.findFirst({
    where: {
      tutorId: tutor.id,
      studentId: String(user.id),
      status: { in: ["PENDING", "CONFIRMED"] as any },
    },
    orderBy: { createdAt: "desc" },
  });
  if (existing) {
    return NextResponse.json({ bookingId: existing.id });
  }

  // Create a lightweight pending booking to open the chat
  const starts = new Date();
  const ends = new Date(starts);
  ends.setMinutes(ends.getMinutes() + ((tutor as any).defaultLessonMinutes || 50));

  const booking = await prisma.booking.create({
    data: {
      studentId: String(user.id),
      tutorId: tutor.id,
      startsAt: starts,
      endsAt: ends,
      status: "PENDING" as any,
      priceCents: 0,
      currency: tutor.currency || "UAH",
      commissionUSDCents: 0,
    },
  });

  return NextResponse.json({ bookingId: booking.id });
}
