import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";
import { Prisma } from "@prisma/client";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function isAdminEmail(sessionUser: any) {
  const adminEmail = process.env.ADMIN_EMAIL || "admin@repetitir.local";
  return !!sessionUser?.email && String(sessionUser.email).toLowerCase() === String(adminEmail).toLowerCase();
}

function issueTypeLabel(t: string) {
  switch (t) {
    case "TUTOR_NO_SHOW":
      return "Викладач не прийшов";
    case "STUDENT_COULD_NOT_JOIN":
      return "Не вдалося приєднатись";
    case "TECHNICAL_PROBLEM":
      return "Технічна проблема";
    case "QUALITY_NOT_AS_EXPECTED":
      return "Якість не відповідала очікуванням";
    default:
      return "Інше";
  }
}

export async function GET(req: NextRequest) {
  const session = await auth();
  const viewer = session?.user as any;
  if (!isAdminEmail(viewer)) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const url = new URL(req.url);
  const status = String(url.searchParams.get("status") || "open").toLowerCase();
  const effectiveStatus = status === "all" ? "ALL" : status === "resolved" ? "RESOLVED" : status === "rejected" ? "REJECTED" : "OPEN";

  const where: any = {};
  if (effectiveStatus !== "ALL") where.status = effectiveStatus;

  const items = await (prisma as any).lessonIssue.findMany({
    where,
    include: {
      booking: { include: { student: true, tutor: { include: { user: true } } } },
      reporter: true,
    },
    orderBy: { createdAt: "desc" },
    take: 200,
  });

  return NextResponse.json({ ok: true, items });
}

export async function POST(req: NextRequest) {
  const session = await auth();
  const viewer = session?.user as any;
  if (!isAdminEmail(viewer)) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const body = await req.json().catch(() => null);
  if (!body) return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });

  const issueId = String((body as any)?.issueId || "").trim();
  const decision = String((body as any)?.decision || "").trim(); // 'student' | 'tutor'
  const note = String((body as any)?.note || "").trim().slice(0, 2000);

  if (!issueId) return NextResponse.json({ error: "issueId required" }, { status: 400 });
  if (decision !== "student" && decision !== "tutor") {
    return NextResponse.json({ error: "decision must be 'student' or 'tutor'" }, { status: 400 });
  }

  const adminEmail = process.env.ADMIN_EMAIL || "admin@repetitir.local";

  const result = await prisma.$transaction(async (tx: Prisma.TransactionClient) => {
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

    async function ensureAdminSupportBooking(targetUserId: string) {
      let adminTutor = await tx.tutor.findUnique({ where: { userId: adminUser!.id } });
      if (!adminTutor) {
        adminTutor = await tx.tutor.create({
          data: {
            userId: adminUser!.id,
            bio: "",
            headline: "",
            rateCents: 0,
            currency: "UAH",
            languages: [adminUser!.locale || "uk"],
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
      if (existing) return existing.id;

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
      return created.id;
    }

    const issue = await (tx as any).lessonIssue.findUnique({
      where: { id: issueId },
      include: { booking: true },
    });
    if (!issue) throw new Error("ISSUE_NOT_FOUND");

    const booking = await tx.booking.findUnique({
      where: { id: String(issue.bookingId) },
      include: { student: true, tutor: { include: { user: true } } },
    });
    if (!booking) throw new Error("BOOKING_NOT_FOUND");

    if (String(issue.status) !== "OPEN") {
      return { ok: true, issue, booking, alreadyHandled: true };
    }

    const issueType = String((issue as any).type || "OTHER");

    if (decision === "student") {
      // Idempotency: if booking already refunded/canceled, do not refund credits twice
      const st = String((booking as any).status || "");
      const alreadyFinal = st === "REFUNDED" || st === "CANCELED";

      await (tx as any).lessonIssue.update({ where: { id: issueId }, data: { status: "RESOLVED" } });

      const didRefund = !alreadyFinal
        ? await tx.booking.updateMany({
            where: { id: booking.id, status: { notIn: ["REFUNDED" as any, "CANCELED" as any] } },
            data: { status: "REFUNDED" },
          })
        : { count: 0 };

      const paymentId = String((booking as any).paymentId || "");
      const paidWithCredits = paymentId.startsWith("credits");
      const transferKey = paymentId.startsWith("credits_transfer:") ? paymentId.replace(/^credits_transfer:/, "").trim() : "";

      if (paidWithCredits && didRefund?.count) {
        const lb = (tx as any)?.lessonBalance;
        if (lb?.upsert) {
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
        }
      }

      const supportBookingId = await ensureAdminSupportBooking(booking.studentId);
      await tx.message.create({
        data: {
          bookingId: supportBookingId,
          senderId: adminUser.id,
          content:
            `✅ Рішення по зверненню: на користь студента.\n` +
            `Причина: ${issueTypeLabel(issueType)}.\n` +
            (paidWithCredits
              ? didRefund?.count
                ? `Кредит за урок повернуто.`
                : `Кредит за урок вже було повернуто раніше.`
              : `Потрібна ручна перевірка/повернення оплати (якщо була).`) +
            (note ? `\nКоментар менеджера: ${note}` : ""),
          attachments: [],
        },
      });

      return { ok: true };
    }

    // decision === 'tutor'
    await (tx as any).lessonIssue.update({ where: { id: issueId }, data: { status: "REJECTED" } });

    const nextStatus = (booking as any).endedAt ? "COMPLETED" : booking.status === "DISPUTED" ? "CONFIRMED" : booking.status;
    await tx.booking.update({ where: { id: booking.id }, data: { status: nextStatus } });

    const supportBookingId = await ensureAdminSupportBooking(booking.studentId);
    await tx.message.create({
      data: {
        bookingId: supportBookingId,
        senderId: adminUser.id,
        content:
          `✅ Рішення по зверненню: на користь викладача.\n` +
          `Причина: ${issueTypeLabel(issueType)}.\n` +
          `Урок зараховано.` +
          (note ? `\nКоментар менеджера: ${note}` : ""),
        attachments: [],
      },
    });

    return { ok: true };
  });

  return NextResponse.json(result);
}
