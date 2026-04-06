import { NextRequest, NextResponse } from "next/server";
import { createLivekitToken, isLivekitConfigured } from "@/lib/livekit";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

function isWithinWindow(params: { startsAt: Date; endsAt: Date; now?: Date }) {
  const now = params.now ? params.now.getTime() : Date.now();
  const openAt = params.startsAt.getTime() - 10 * 60 * 1000;
  const closeAt = params.endsAt.getTime() + 15 * 60 * 1000;
  return now >= openAt && now <= closeAt;
}

export async function POST(req: NextRequest) {
  try {
    const session = await auth();
    const user = session?.user as any;
    if (!user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    if (!isLivekitConfigured()) {
      return NextResponse.json({ error: "LiveKit not configured" }, { status: 500 });
    }

    const body = await req.json().catch(() => null);
    if (!body) return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });

    const { bookingId, room } = body as {
      bookingId?: string;
      room?: string;
    };

    const id = String(bookingId || room || "").trim();
    if (!id) return NextResponse.json({ error: "Missing bookingId" }, { status: 400 });

    const booking = await prisma.booking.findUnique({ where: { id } });
    if (!booking) return NextResponse.json({ error: "Booking not found" }, { status: 404 });
    const tutor = await prisma.tutor.findUnique({ where: { id: booking.tutorId } });

    const isMember = booking.studentId === String(user.id) || tutor?.userId === String(user.id);
    if (!isMember) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

    if ((booking as any).endedAt) {
      return NextResponse.json({ error: "Lesson ended" }, { status: 410 });
    }

    if (!isWithinWindow({ startsAt: booking.startsAt, endsAt: booking.endsAt })) {
      return NextResponse.json({ error: "Not available yet" }, { status: 423 });
    }

    const roomName = `booking-${booking.id}`;
    const token = await createLivekitToken({ room: roomName, identity: String(user.id), name: user?.name || "User" });
    const url = process.env.LIVEKIT_URL || "";
    if (!url) {
      return NextResponse.json({ error: "LIVEKIT_URL is empty" }, { status: 500 });
    }
    return NextResponse.json({ token, url, room: roomName });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || "Server error" }, { status: 500 });
  }
}
