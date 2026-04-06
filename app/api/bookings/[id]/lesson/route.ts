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

    const booking = await prisma.booking.findUnique({ where: { id } });
    if (!booking) return NextResponse.json({ error: "Not found" }, { status: 404 });

    const tutor = await prisma.tutor.findUnique({ where: { id: booking.tutorId } });
    const isTutor = tutor?.userId === String(user.id);
    if (!isTutor) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

    const contentType = req.headers.get("content-type") || "";
    let action = "";
    if (contentType.includes("application/json")) {
      const body = await req.json().catch(() => null);
      action = String((body as any)?.action || "").trim();
    } else {
      const form = await req.formData().catch(() => null);
      action = form ? String(form.get("action") || "").trim() : "";
    }

    if (action !== "start" && action !== "end") {
      return NextResponse.json({ error: "Invalid action" }, { status: 400 });
    }

    if (action === "start") {
      const updated = await (prisma.booking as any).update({
        where: { id: booking.id },
        data: {
          startedAt: (booking as any).startedAt ?? new Date(),
        },
      });
      return NextResponse.json({ booking: updated });
    }

    const updated = await prisma.$transaction(async (tx) => {
      const wasConfirmed = String(booking.status) === "CONFIRMED";
      const nextStatus = booking.status === "DISPUTED" ? "DISPUTED" : wasConfirmed ? "COMPLETED" : booking.status;
      const next = await (tx.booking as any).update({
        where: { id: booking.id },
        data: {
          endedAt: new Date(),
          status: nextStatus,
        },
      });

      if (nextStatus === "COMPLETED" && wasConfirmed) {
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

    return NextResponse.json({ booking: updated });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || "Server error" }, { status: 500 });
  }
}
