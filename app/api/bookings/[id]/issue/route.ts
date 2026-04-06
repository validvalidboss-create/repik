import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";

function normalizeIssueType(raw: unknown) {
  const v = String(raw || "").trim().toUpperCase();
  if (v === "TUTOR_NO_SHOW") return "TUTOR_NO_SHOW" as const;
  if (v === "STUDENT_COULD_NOT_JOIN") return "STUDENT_COULD_NOT_JOIN" as const;
  if (v === "TECHNICAL_PROBLEM") return "TECHNICAL_PROBLEM" as const;
  if (v === "QUALITY_NOT_AS_EXPECTED") return "QUALITY_NOT_AS_EXPECTED" as const;
  return "OTHER" as const;
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
      return "Якість уроку не відповідала очікуванням";
    default:
      return "Інше";
  }
}

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await auth();
    const user = session?.user as any;
    if (!user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const resolvedParams: any = typeof (params as any)?.then === "function" ? await (params as any) : params;
    const id = resolvedParams?.id ? String(resolvedParams.id) : "";
    if (!id) return NextResponse.json({ error: "Invalid booking id" }, { status: 400 });

    const body = await req.json().catch(() => null);
    const type = normalizeIssueType(body?.type);
    const message = String(body?.message || "").trim().slice(0, 2000);

    const shouldDispute = type !== "STUDENT_COULD_NOT_JOIN";

    const booking = await prisma.booking.findUnique({
      where: { id },
      include: { tutor: { include: { user: true } }, student: true },
    });
    if (!booking) return NextResponse.json({ error: "Not found" }, { status: 404 });

    const endsAtMs = new Date(booking.endsAt).getTime();
    if (Number.isFinite(endsAtMs) && Date.now() < endsAtMs) {
      return NextResponse.json({
        error: "Повідомити про проблему можна лише після завершення уроку.",
      }, { status: 400 });
    }
    if (Number.isFinite(endsAtMs)) {
      const AUTO_COMPLETE_HOURS = 72;
      const cutoffMs = Date.now() - AUTO_COMPLETE_HOURS * 60 * 60 * 1000;
      if (endsAtMs < cutoffMs) {
        return NextResponse.json({
          error: "Минув час для звернення. Повідомити про проблему можна протягом 72 годин після уроку.",
        }, { status: 400 });
      }
    }

    const userId = String(user.id);
    const isStudent = booking.studentId === userId;
    if (!isStudent) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

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

      const issue = await (tx as any).lessonIssue.create({
        data: {
          bookingId: booking.id,
          reporterId: userId,
          type,
          status: shouldDispute ? "OPEN" : "REJECTED",
          message: message || null,
        },
      });

      // Put booking under review; do NOT auto-complete/pay out.
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

      return { issue, outcome: shouldDispute ? "UNDER_REVIEW" : "COUNTED_FOR_TUTOR" };
    });

    return NextResponse.json({ ok: true, issue: (created as any).issue, outcome: (created as any).outcome });
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: e?.message || "Server error" }, { status: 500 });
  }
}
