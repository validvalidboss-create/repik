import { NextRequest } from "next/server";
import { BookingStatus } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { confirmBookingPaid } from "@/lib/booking/confirmPaid";

export async function POST(req: NextRequest) {
  try {
    const payload = await req.formData();
    // TODO: verify signature with FONDY_SECRET
    const orderId = (payload.get("order_id") as string) || "";
    const status = String((payload.get("order_status") as string) || "").toLowerCase();

    if (!orderId) return new Response("bad request", { status: 400 });

    const booking = await prisma.booking.findUnique({ where: { id: String(orderId) }, select: { paymentId: true } }).catch(() => null);
    const paymentId = String((booking as any)?.paymentId || "");
    const isCredits = paymentId.startsWith("credits");
    const isFreeFirst = paymentId === "free_first";
    if (isCredits || isFreeFirst) {
      return new Response("ok");
    }

    if (status === "approved" || status === "success" || status === "processing") {
      await confirmBookingPaid({ bookingId: orderId, provider: "fondy" });
    } else if (status === "declined" || status === "reversed" || status === "expired") {
      await prisma.booking.update({ where: { id: orderId }, data: { status: BookingStatus.CANCELED } });
    } else if (status === "refunded") {
      await prisma.booking.update({ where: { id: orderId }, data: { status: BookingStatus.REFUNDED } });
    }

    return new Response("ok");
  } catch (e) {
    return new Response("server error", { status: 500 });
  }
}
