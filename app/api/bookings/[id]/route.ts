import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  const user = session?.user as any;
  if (!user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const resolvedParams: any = typeof (params as any)?.then === "function" ? await (params as any) : params;
  const id = resolvedParams?.id ? String(resolvedParams.id) : "";
  if (!id) return NextResponse.json({ error: "Invalid booking id" }, { status: 400 });
  let booking = await prisma.booking.findUnique({ where: { id } });
  if (!booking) return NextResponse.json({ error: "Not found" }, { status: 404 });
  // gate: only student or tutor can see
  const tutor = await prisma.tutor.findUnique({ where: { id: booking.tutorId } });
  const isTutor = tutor?.userId === String(user.id);
  const isMember = booking.studentId === String(user.id) || isTutor;
  if (!isMember) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const AUTO_COMPLETE_HOURS = 72;
  if (String(booking.status) === "CONFIRMED") {
    const hasOpenIssue = await (prisma as any).lessonIssue.findFirst({
      where: { bookingId: booking.id, status: "OPEN" },
      select: { id: true },
    });
    if (hasOpenIssue) {
      return NextResponse.json({ booking, isTutor });
    }

    const endsAtMs = new Date(booking.endsAt).getTime();
    if (Number.isFinite(endsAtMs)) {
      const cutoffMs = Date.now() - AUTO_COMPLETE_HOURS * 60 * 60 * 1000;
      if (endsAtMs < cutoffMs) {
        booking = await prisma.$transaction(async (tx) => {
          const updated = await tx.booking.update({
            where: { id: booking.id },
            data: {
              status: "COMPLETED",
              endedAt: (booking as any).endedAt ?? booking.endsAt,
            },
          });

          const paymentId = String((booking as any)?.paymentId || "");
          if (paymentId === "free_first") {
            const tb = (tx as any)?.trialBalance;
            if (tb?.updateMany) {
              await tb.updateMany({
                where: { studentId: String(booking.studentId), credits: { gt: 0 } },
                data: { credits: { decrement: 1 } },
              });
            }
          } else if (paymentId === "credits" || paymentId === "credits_dev" || paymentId.startsWith("credits_transfer:")) {
            const lb = (tx as any)?.lessonBalance;
            if (lb?.updateMany) {
              await lb.updateMany({
                where: { studentId: String(booking.studentId), tutorId: String(booking.tutorId), credits: { gt: 0 } },
                data: { credits: { decrement: 1 } },
              });
            }
          }

          return updated as any;
        });
      }
    }
  }
  return NextResponse.json({ booking, isTutor });
}

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  const user = session?.user as any;
  if (!user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const resolvedParams: any = typeof (params as any)?.then === "function" ? await (params as any) : params;
  const id = resolvedParams?.id ? String(resolvedParams.id) : "";
  if (!id) return NextResponse.json({ error: "Invalid booking id" }, { status: 400 });

  const body = await req.json().catch(() => null);
  const startsAtISO = body?.startsAtISO ? String(body.startsAtISO) : "";
  if (!startsAtISO) return NextResponse.json({ error: "Missing startsAtISO" }, { status: 400 });

  const adminEmail = process.env.ADMIN_EMAIL || "admin@repetitir.local";
  const CANCEL_LESSON_CUTOFF_HOURS = 12;
  const minStart = Date.now() + CANCEL_LESSON_CUTOFF_HOURS * 60 * 60 * 1000;

  const newStartsAt = new Date(startsAtISO);
  if (isNaN(newStartsAt.getTime())) {
    return NextResponse.json({ error: "Invalid date" }, { status: 400 });
  }
  if (newStartsAt.getTime() < minStart) {
    return NextResponse.json(
      { ok: false, error: `Урок можна перенести щонайменше за ${CANCEL_LESSON_CUTOFF_HOURS} годин до початку` },
      { status: 400 }
    );
  }

  try {
    const booking = await prisma.booking.findUnique({
      where: { id },
      include: { tutor: { include: { user: true } }, student: true },
    });
    if (!booking) return NextResponse.json({ ok: false, error: "Not found" }, { status: 404 });

    const tutor = await prisma.tutor.findUnique({ where: { id: booking.tutorId } });
    const isTutor = tutor?.userId === String(user.id);
    const isMember = booking.studentId === String(user.id) || isTutor;
    if (!isMember) return NextResponse.json({ ok: false, error: "Forbidden" }, { status: 403 });

    const st = String(booking.status || "");
    if (st !== "CONFIRMED") {
      return NextResponse.json({ ok: false, error: "Only confirmed lessons can be rescheduled" }, { status: 400 });
    }

    const durationMin = Number((booking as any).durationMinutes || 60) || 60;
    const newEndsAt = new Date(newStartsAt.getTime() + durationMin * 60 * 1000);

    const updated = await prisma.booking.update({
      where: { id: booking.id },
      data: { startsAt: newStartsAt, endsAt: newEndsAt },
    });

    let adminUser = await prisma.user.findUnique({ where: { email: adminEmail } });
    if (!adminUser) {
      adminUser = await prisma.user.create({
        data: {
          email: adminEmail,
          name: "Адміністрація",
          role: "ADMIN",
          locale: "uk",
        },
      });
    }

    const oldStarts = new Date(booking.startsAt);
    const oldDateStr = oldStarts.toLocaleDateString(undefined);
    const oldTimeStr = oldStarts.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
    const newDateStr = newStartsAt.toLocaleDateString(undefined);
    const newTimeStr = newStartsAt.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });

    const who = isTutor ? "викладач" : "студент";
    await prisma.message.create({
      data: {
        bookingId: booking.id,
        senderId: adminUser.id,
        content:
          `📅 Урок перенесено (${who}).\n` +
          `Було: ${oldDateStr} о ${oldTimeStr}.\n` +
          `Стало: ${newDateStr} о ${newTimeStr}.`,
        attachments: [],
      },
    });

    return NextResponse.json({ ok: true, booking: updated });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Server error";
    return NextResponse.json({ ok: false, error: msg }, { status: 500 });
  }
}
