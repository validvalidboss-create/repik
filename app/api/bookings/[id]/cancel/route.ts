import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  const user = session?.user as any;
  if (!user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const resolvedParams: any = typeof (params as any)?.then === "function" ? await (params as any) : params;
  const id = resolvedParams?.id ? String(resolvedParams.id) : "";
  if (!id) return NextResponse.json({ error: "Invalid booking id" }, { status: 400 });

  const body = await req.json().catch(() => null);
  const reason = typeof body?.reason === "string" ? String(body.reason).trim() : "";
  if (!reason) return NextResponse.json({ error: "reason required" }, { status: 400 });

  const adminEmail = process.env.ADMIN_EMAIL || "admin@repetitir.local";

  try {
    const result = await prisma.$transaction(async (tx) => {
      async function ensureAdminSupportBooking(targetUserId: string) {
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

        let adminTutor = await tx.tutor.findUnique({ where: { userId: adminUser.id } });
        if (!adminTutor) {
          adminTutor = await tx.tutor.create({
            data: {
              userId: adminUser.id,
              bio: "",
              headline: "",
              rateCents: 0,
              currency: "UAH",
              languages: [adminUser.locale || "uk"],
              subjects: ["support"],
              tracks: ["status:system"],
            },
          });
        }

        const existing = await tx.booking.findFirst({
          where: {
            tutorId: adminTutor.id,
            studentId: targetUserId,
            status: { in: ["PENDING", "CONFIRMED"] as any },
          },
          orderBy: { createdAt: "desc" },
        });
        if (existing) return { bookingId: existing.id, adminUserId: adminUser.id };

        const startsAt = new Date();
        const endsAt = new Date(startsAt);
        endsAt.setMinutes(endsAt.getMinutes() + 50);
        const created = await tx.booking.create({
          data: {
            studentId: targetUserId,
            tutorId: adminTutor.id,
            startsAt,
            endsAt,
            status: "PENDING" as any,
            priceCents: 0,
            currency: "UAH",
            commissionUSDCents: 0,
          },
        });
        return { bookingId: created.id, adminUserId: adminUser.id };
      }

      const booking = await tx.booking.findUnique({
        where: { id },
        include: { tutor: { include: { user: true } }, student: true },
      });
      if (!booking) return { ok: false as const, status: 404 as const, error: "Not found" };

      const isTutor = booking.tutor?.userId === String(user.id);
      const isStudent = booking.studentId === String(user.id);
      if (!isTutor && !isStudent) return { ok: false as const, status: 403 as const, error: "Forbidden" };

      if (String(booking.status) === "COMPLETED") {
        return { ok: false as const, status: 400 as const, error: "Completed lessons cannot be canceled" };
      }

      if (String(booking.status) === "CANCELED" || String(booking.status) === "REFUNDED") {
        return { ok: true as const, bookingId: booking.id, already: true as const };
      }

      const CANCEL_LESSON_CUTOFF_HOURS = 12;
      const startsAtMs = new Date(booking.startsAt).getTime();
      if (Number.isFinite(startsAtMs)) {
        const diffMs = startsAtMs - Date.now();
        if (diffMs < CANCEL_LESSON_CUTOFF_HOURS * 60 * 60 * 1000) {
          return {
            ok: false as const,
            status: 400 as const,
            error: "Скасування доступне не пізніше ніж за 12 годин до початку. Використайте перенесення.",
          };
        }
      }

      const canceled = await tx.booking.updateMany({
        where: { id: booking.id, status: { notIn: ["CANCELED" as any, "REFUNDED" as any, "COMPLETED" as any] } },
        data: { status: "CANCELED" },
      });
      if (!canceled?.count) {
        return { ok: true as const, bookingId: booking.id, already: true as const };
      }

      const adminSupport = await ensureAdminSupportBooking(booking.studentId);

      const startsAt = new Date(booking.startsAt);
      const endsAt = new Date(booking.endsAt);
      const dateStr = startsAt.toLocaleDateString(undefined);
      const timeStr = startsAt.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
      const durRaw = Number((booking as any).durationMinutes || 0) || 0;
      const durFromDates = Math.max(0, Math.round((endsAt.getTime() - startsAt.getTime()) / 60000));
      const dur = durRaw > 0 ? durRaw : durFromDates;
      const studentName = (booking.student as any)?.name || (booking.student as any)?.email || "Студент";
      const tutorName = (booking.tutor as any)?.user?.name || (booking.tutor as any)?.user?.email || "Репетитор";

      const paymentId = String((booking as any)?.paymentId || "");
      const isCredits = paymentId.startsWith("credits");
      const isFreeFirst = paymentId === "free_first";
      const isFondy = !!paymentId && !isCredits && !isFreeFirst;
      const transferKey = paymentId.startsWith("credits_transfer:") ? paymentId.replace(/^credits_transfer:/, "").trim() : "";

      const isTrial = dur === 30;
      const CANCEL_TRIAL_REFUND_HOURS = 12;
      const refundableTrialByTime = startsAt.getTime() - Date.now() > CANCEL_TRIAL_REFUND_HOURS * 60 * 60 * 1000;

      let refundedCredit = false;
      const lb = (tx as any)?.lessonBalance;
      if (lb?.upsert) {
        if (isCredits) {
          let refundTutorId = booking.tutorId;
          if (transferKey) {
            const tr = await (tx as any).creditsTransfer
              ?.findUnique?.({ where: { transferKey }, select: { fromTutorId: true } })
              .catch(() => null);
            const fromId = String((tr as any)?.fromTutorId || "").trim();
            if (fromId) refundTutorId = fromId;
          }
          await lb.upsert({
            where: { studentId_tutorId: { studentId: booking.studentId, tutorId: refundTutorId } },
            create: { studentId: booking.studentId, tutorId: refundTutorId, credits: 1 },
            update: { credits: { increment: 1 } },
          });
          refundedCredit = true;
        } else if (isStudent && isFondy && isTrial && refundableTrialByTime) {
          await lb.upsert({
            where: { studentId_tutorId: { studentId: booking.studentId, tutorId: booking.tutorId } },
            create: { studentId: booking.studentId, tutorId: booking.tutorId, credits: 1 },
            update: { credits: { increment: 1 } },
          });
          refundedCredit = true;
        }
      }

      const tb = (tx as any)?.trialBalance;
      if (isStudent && isFreeFirst && tb?.upsert) {
        try {
          await tb.upsert({
            where: { studentId: booking.studentId },
            create: { studentId: booking.studentId, credits: 4 },
            update: { credits: { increment: 1 } },
          });
        } catch {
          // ignore
        }
      }

      const who = isTutor ? "викладачем" : "студентом";
      const cancelText =
        `❌ Урок скасовано ${who}.\n` +
        `Дата: ${dateStr} о ${timeStr} (${dur} хв).\n` +
        `Причина: ${reason}\n` +
        `Якщо у вас є питання — напишіть тут, будь ласка.`;

      await tx.message.create({
        data: {
          bookingId: booking.id,
          senderId: adminSupport.adminUserId,
          content: cancelText,
          attachments: [],
        },
      });

      const adminText =
        `⚠️ Скасування уроку викладачем.\n` +
        `Booking: ${booking.id}\n` +
        `Tutor: ${tutorName} (${booking.tutorId})\n` +
        `Student: ${studentName} (${booking.studentId})\n` +
        `Коли: ${dateStr} ${timeStr} (${dur} хв)\n` +
        `Причина: ${reason}\n` +
        `Платіж: ${paymentId || "—"}\n` +
        `Credit compensation: ${refundedCredit ? "yes" : "no"}`;

      const adminText2 = adminText.replace("викладачем", who);

      await tx.message.create({
        data: {
          bookingId: adminSupport.bookingId,
          senderId: adminSupport.adminUserId,
          content: adminText2,
          attachments: [],
        },
      });

      return { ok: true as const, bookingId: booking.id, refundedCredit };
    });

    if (!result.ok) return NextResponse.json({ ok: false, error: result.error }, { status: result.status });
    return NextResponse.json(result);
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Server error";
    return NextResponse.json({ ok: false, error: msg }, { status: 500 });
  }
}
