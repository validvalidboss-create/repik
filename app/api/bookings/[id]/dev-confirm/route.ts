import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";
import { confirmBookingPaid } from "@/lib/booking/confirmPaid";

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const p = await params;
    const form = await req.formData().catch(() => null);
    const locale = form ? String(form.get("locale") || "uk") : "uk";
    const bookingId = String((p as any)?.id || "");

    const backToPay = (code: string) => {
      const safeId = bookingId || "";
      const url = new URL(`/${locale}/pay/${safeId}`, req.url);
      url.searchParams.set("dev_error", code);
      return NextResponse.redirect(url, 303);
    };

    const session = await auth();
    const user = session?.user as any;
    if (!user?.id) return backToPay("unauthorized");

    if (!bookingId) return backToPay("missing_booking_id");

    const booking = await prisma.booking.findUnique({ where: { id: bookingId } });
    if (!booking) return backToPay("not_found");

    const tutor = await prisma.tutor.findUnique({ where: { id: booking.tutorId } });
    const isTutor = tutor?.userId === String(user.id);
    const isMember = booking.studentId === String(user.id) || isTutor;
    if (!isMember) return backToPay("forbidden");

    if (booking.status === "PENDING") {
      await confirmBookingPaid({ bookingId: booking.id, provider: "dev" });
    }

    const url = new URL(`/${locale}/lesson/${booking.id}`, req.url);
    return NextResponse.redirect(url, 303);
  } catch (e) {
    const msg = e instanceof Error ? e.message : "server_error";
    const code = String(msg || "server_error").slice(0, 80);
    const locale = "uk";
    let bookingId = "";
    try {
      const p = await params;
      bookingId = String((p as any)?.id || "");
    } catch {}
    const url = new URL(`/${locale}/pay/${bookingId || ""}`, req.url);
    url.searchParams.set("dev_error", code);
    return NextResponse.redirect(url, 303);
  }
}
