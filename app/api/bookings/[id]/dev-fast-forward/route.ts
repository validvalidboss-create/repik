import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    if (process.env.NODE_ENV === "production") {
      return NextResponse.json({ error: "Not available" }, { status: 404 });
    }

    const req = _req;
    const contentType = req.headers.get("content-type") || "";
    const form = contentType.includes("application/x-www-form-urlencoded") || contentType.includes("multipart/form-data")
      ? await req.formData().catch(() => null)
      : null;
    const locale = form ? String(form.get("locale") || "uk") : "uk";
    const back = form ? String(form.get("back") || "lesson") : "lesson";

    const session = await auth();
    const user = session?.user as any;
    if (!user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const resolvedParams: any = typeof (params as any)?.then === "function" ? await (params as any) : params;
    const id = resolvedParams?.id ? String(resolvedParams.id) : "";
    if (!id) return NextResponse.json({ error: "Invalid booking id" }, { status: 400 });

    const booking = await prisma.booking.findUnique({ where: { id } });
    if (!booking) return NextResponse.json({ error: "Not found" }, { status: 404 });

    const userId = String(user.id);
    const allowed = booking.studentId === userId;
    if (!allowed) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

    const now = Date.now();
    const endedAt = new Date(now - 2 * 60 * 60 * 1000);
    const endsAt = new Date(endedAt);
    const durationMin = Number((booking as any).durationMinutes || 60) || 60;
    const startsAt = new Date(endsAt.getTime() - durationMin * 60 * 1000);

    const updated = await prisma.$transaction(async (tx) => {
      const prevStatus = String((booking as any)?.status || "");
      const nextStatus = prevStatus === "PENDING" ? "CONFIRMED" : prevStatus === "DISPUTED" ? "DISPUTED" : "COMPLETED";
      const next = await (tx.booking as any).update({
        where: { id: booking.id },
        data: {
          startsAt,
          endsAt,
          startedAt: (booking as any).startedAt ?? startsAt,
          endedAt: (booking as any).endedAt ?? endedAt,
          status: nextStatus,
        },
      });

      const shouldDebit =
        prevStatus === "CONFIRMED" &&
        nextStatus === "COMPLETED" &&
        !(booking as any)?.endedAt;

      if (shouldDebit) {
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
      }

      return next;
    });

    if (form) {
      const url = back === "dashboard"
        ? new URL(`/${locale}/dashboard#schedule`, req.url)
        : new URL(`/${locale}/lesson/${booking.id}`, req.url);
      return NextResponse.redirect(url, 303);
    }

    return NextResponse.json({ ok: true, booking: updated });
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: e?.message || "Server error" }, { status: 500 });
  }
}
