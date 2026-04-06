import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function issueTypeLabel(t: string) {
  switch (t) {
    case "TUTOR_NO_SHOW":
      return "Викладач не прийшов";
    case "STUDENT_COULD_NOT_JOIN":
      return "Не вдалося приєднатись";
    case "TECHNICAL_PROBLEM":
      return "Технічна проблема";
    case "QUALITY_NOT_AS_EXPECTED":
      return "Якість уроку не відповідала очікуванням";
    default:
      return "Інше";
  }
}

function normalizeIssueType(raw: unknown) {
  const v = String(raw || "")
    .trim()
    .toUpperCase();
  if (v === "TUTOR_NO_SHOW") return "TUTOR_NO_SHOW" as const;
  if (v === "STUDENT_COULD_NOT_JOIN") return "STUDENT_COULD_NOT_JOIN" as const;
  if (v === "TECHNICAL_PROBLEM") return "TECHNICAL_PROBLEM" as const;
  if (v === "QUALITY_NOT_AS_EXPECTED") return "QUALITY_NOT_AS_EXPECTED" as const;
  return "OTHER" as const;
}

export async function POST(req: NextRequest) {
  try {
    const session = await auth();
    const user = session?.user as any;
    const userId = user?.id ? String(user.id) : "";
    if (!userId) return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });

    const body = await req.json().catch(() => null);
    const tutorId = String(body?.tutorId || "").trim();
    const type = normalizeIssueType(body?.type);
    const message = String(body?.message || "").trim().slice(0, 2000);
    if (!tutorId) return NextResponse.json({ ok: false, error: "tutorId required" }, { status: 400 });

    const AUTO_COMPLETE_HOURS = 72;
    const cutoffMs = Date.now() - AUTO_COMPLETE_HOURS * 60 * 60 * 1000;

    const booking = await prisma.booking.findFirst({
      where: {
        studentId: userId,
        tutorId,
        endsAt: { lte: new Date(), gte: new Date(cutoffMs) },
        status: { in: ["CONFIRMED", "COMPLETED", "DISPUTED", "REFUNDED", "CANCELED"] as any },
      },
      include: { student: true },
      orderBy: { endsAt: "desc" },
    });

    if (!booking) {
      return NextResponse.json(
        {
          ok: false,
          error: "Немає завершених уроків за останні 72 години, щоб створити звернення.",
        },
        { status: 404 },
      );
    }

    const endsAtMs = new Date(booking.endsAt).getTime();
    if (Number.isFinite(endsAtMs) && Date.now() < endsAtMs) {
      return NextResponse.json(
        {
          ok: false,
          error: "Повідомити про проблему можна лише після завершення уроку.",
        },
        { status: 400 },
      );
    }

    const adminEmail = process.env.ADMIN_EMAIL || "admin@repetitir.local";

    const created = await prisma.$transaction(async (tx) => {
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

      const existingIssue = await (tx as any).lessonIssue.findFirst({
        where: {
          bookingId: booking.id,
          reporterId: userId,
          status: "OPEN",
        },
        orderBy: { createdAt: "desc" },
      });

      const shouldDispute = type !== "STUDENT_COULD_NOT_JOIN";

      if (existingIssue) {
        return { issue: existingIssue, bookingId: booking.id, outcome: shouldDispute ? "UNDER_REVIEW" : "COUNTED_FOR_TUTOR", alreadyExists: true };
      }

      const issue = await (tx as any).lessonIssue.create({
        data: {
          bookingId: booking.id,
          reporterId: userId,
          type,
          status: shouldDispute ? "OPEN" : "REJECTED",
          message: message || null,
        },
      });

      if (shouldDispute) {
        if (booking.status !== "DISPUTED") {
          await tx.booking.update({ where: { id: booking.id }, data: { status: "DISPUTED" } });
        }
      }

      const startsAt = new Date(booking.startsAt);
      const dateStr = startsAt.toLocaleDateString(undefined);
      const timeStr = startsAt.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
      const studentName = (booking.student as any)?.name || (booking.student as any)?.email || "Студент";

      const prefix = "⚠️ Повідомлення про проблему.";
      await tx.message.create({
        data: {
          bookingId: booking.id,
          senderId: adminUser.id,
          content:
            `${prefix} ${studentName} повідомив(ла) про проблему після уроку ${dateStr} о ${timeStr}.\n` +
            `Причина: ${issueTypeLabel(type)}.\n` +
            (shouldDispute ? "Статус: НА РОЗГЛЯДІ менеджера.\n" : "Статус: інформаційно (урок зараховано).\n") +
            (message ? `Коментар: ${message}` : ""),
          attachments: [],
        },
      });

      return { issue, bookingId: booking.id, outcome: shouldDispute ? "UNDER_REVIEW" : "COUNTED_FOR_TUTOR", alreadyExists: false };
    });

    return NextResponse.json({ ok: true, ...created });
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: e?.message || "Server error" }, { status: 500 });
  }
}
