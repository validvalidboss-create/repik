import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";

export async function POST(req: NextRequest) {
  const session = await auth();
  const user = session?.user as any;
  if (!user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json().catch(() => null);
  const bookingId = body?.bookingId as string | undefined;
  const rating = Number(body?.rating);
  const text = (body?.text ?? "") as string;
  if (!bookingId || !(rating >= 1 && rating <= 5)) {
    return NextResponse.json({ error: "bookingId and rating (1..5) required" }, { status: 400 });
  }

  const booking = await prisma.booking.findUnique({ where: { id: bookingId }, include: { tutor: true } });
  if (!booking) return NextResponse.json({ error: "Booking not found" }, { status: 404 });
  if (!user.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const userId = String(user.id);
  const isMember = booking.studentId === userId || booking.tutor.userId === userId;
  if (!isMember) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  // MVP: allow review when confirmed or completed
  if (booking.status === "DISPUTED") {
    return NextResponse.json({ error: "Lesson is under review" }, { status: 400 });
  }
  if (!(booking.status === "CONFIRMED" || booking.status === "COMPLETED")) {
    return NextResponse.json({ error: "Review allowed after lesson is confirmed or completed" }, { status: 400 });
  }

  // upsert by unique bookingId
  const review = await prisma.review.upsert({
    where: { bookingId },
    update: { rating, text },
    create: { bookingId, authorId: userId, rating, text },
  });

  // recompute tutor aggregates
  const aggregates = await prisma.review.aggregate({
    _avg: { rating: true },
    _count: { rating: true },
    where: { booking: { tutorId: booking.tutorId } },
  });
  await prisma.tutor.update({
    where: { id: booking.tutorId },
    data: { rating: aggregates._avg.rating || 0, ratingCount: aggregates._count.rating || 0 },
  });

  return NextResponse.json({ review });
}
