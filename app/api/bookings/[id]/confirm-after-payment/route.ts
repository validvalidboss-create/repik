import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";
import { confirmBookingPaid } from "@/lib/booking/confirmPaid";

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  const user = session?.user as any;
  if (!user?.id) return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });

  const resolvedParams: any = typeof (params as any)?.then === "function" ? await (params as any) : params;
  const id = resolvedParams?.id ? String(resolvedParams.id) : "";
  if (!id) return NextResponse.json({ ok: false, error: "Invalid booking id" }, { status: 400 });

  const booking = await prisma.booking.findUnique({ where: { id } });
  if (!booking) return NextResponse.json({ ok: false, error: "Not found" }, { status: 404 });

  const tutor = await prisma.tutor.findUnique({ where: { id: booking.tutorId } });
  const isTutor = tutor?.userId === String(user.id);
  const isMember = booking.studentId === String(user.id) || isTutor;
  if (!isMember) return NextResponse.json({ ok: false, error: "Forbidden" }, { status: 403 });

  try {
    if (String(booking.status) === "PENDING") {
      await confirmBookingPaid({ bookingId: booking.id, provider: "fondy" });
    }
    const updated = await prisma.booking.findUnique({ where: { id: booking.id } });
    return NextResponse.json({ ok: true, booking: updated });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Server error";
    return NextResponse.json({ ok: false, error: msg }, { status: 500 });
  }
}
