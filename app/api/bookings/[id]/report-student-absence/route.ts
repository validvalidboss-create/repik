import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await auth();
    const user = session?.user as any;
    if (!user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const resolvedParams: any = typeof (params as any)?.then === "function" ? await (params as any) : params;
    const id = resolvedParams?.id ? String(resolvedParams.id) : "";
    if (!id) return NextResponse.json({ error: "Invalid booking id" }, { status: 400 });

    const booking = await prisma.booking.findUnique({
      where: { id },
      include: { tutor: { include: { user: true } }, student: true },
    });
    if (!booking) return NextResponse.json({ error: "Not found" }, { status: 404 });

    if (String(booking.status) === "CANCELED" || String(booking.status) === "REFUNDED") {
      return NextResponse.json({ ok: true, booking });
    }
    if (String(booking.status) === "COMPLETED") {
      return NextResponse.json({ ok: true, booking });
    }
    if (String(booking.status) !== "CONFIRMED") {
      return NextResponse.json({ error: "Only confirmed lessons can be reported" }, { status: 400 });
    }

    const tutor = await prisma.tutor.findUnique({ where: { id: booking.tutorId } });
    const isTutor = tutor?.userId === String(user.id);
    if (!isTutor) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

    const endsAtMs = new Date(booking.endsAt).getTime();
    if (Number.isFinite(endsAtMs) && Date.now() < endsAtMs) {
      return NextResponse.json({ error: "Цю дію можна виконати лише після завершення уроку." }, { status: 400 });
    }
    if (Number.isFinite(endsAtMs)) {
      const AUTO_COMPLETE_HOURS = 72;
      const cutoffMs = Date.now() - AUTO_COMPLETE_HOURS * 60 * 60 * 1000;
      if (endsAtMs < cutoffMs) {
        return NextResponse.json({
          error: "Минув час для звернення. Повідомити про відсутність студента можна протягом 72 годин після уроку.",
        }, { status: 400 });
      }
    }

    const body = await req.json().catch(() => null);
    const message = String(body?.message || "").trim().slice(0, 2000);

    const isTrial = Number((booking as any).durationMinutes || 0) === 30;

    const adminEmail = process.env.ADMIN_EMAIL || "admin@repetitir.local";

    const result = await prisma.$transaction(async (tx) => {
      const hasOpenIssue = await (tx as any).lessonIssue.findFirst({
        where: { bookingId: booking.id, status: "OPEN" },
        select: { id: true },
      });
      if (hasOpenIssue) {
        throw new Error("OPEN_ISSUE");
      }

      let adminUser = await tx.user.findUnique({ where: { email: adminEmail } });
      if (!adminUser) {
        adminUser = await tx.user.create({
          data: {
            email: adminEmail,
            name: "Адміністрація",
            role: "ADMIN",
            locale: "uk",
          },
        });
      }

      await (tx as any).lessonIssue.create({
        data: {
          bookingId: booking.id,
          reporterId: String(user.id),
          type: "OTHER",
          status: "REJECTED",
          message:
            (message ? `${message}\n\n` : "") +
            (isTrial
              ? "[SYSTEM] Tutor reported: student was absent (trial lesson)"
              : "[SYSTEM] Tutor reported: student was absent (regular lesson; student charged)"),
        },
      });

      const updated = await tx.booking.update({
        where: { id: booking.id },
        data: {
          status: booking.status === "DISPUTED" ? "DISPUTED" : (isTrial ? ("MISSED_TRIAL" as any) : "COMPLETED"),
          endedAt: (booking as any).endedAt ?? new Date(),
        },
      });

      const startsAt = new Date(booking.startsAt);
      const dateStr = startsAt.toLocaleDateString(undefined);
      const timeStr = startsAt.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
      const dur = Number((booking as any).durationMinutes || 0) || 0;

      const prefix = "⚠️ Студент не прийшов на урок.";
      await tx.message.create({
        data: {
          bookingId: booking.id,
          senderId: adminUser.id,
          content:
            `${prefix}\n` +
            `Дата: ${dateStr} о ${timeStr} (${dur} хв).\n` +
            (isTrial ? "Тип: пробний урок.\n" : "Тип: звичайний урок.\n") +
            (message ? `Коментар: ${message}` : ""),
          attachments: [],
        },
      });

      return { booking: updated };
    });

    return NextResponse.json({ ok: true, booking: (result as any).booking });
  } catch (e: any) {
    if (String(e?.message || "") === "OPEN_ISSUE") {
      return NextResponse.json({ ok: false, error: "Урок має відкритий спір. Спочатку вирішіть спір." }, { status: 400 });
    }
    return NextResponse.json({ ok: false, error: e?.message || "Server error" }, { status: 500 });
  }
}
