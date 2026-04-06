import { NextRequest, NextResponse } from "next/server";
import { fondySignature, isFondyConfigured } from "@/lib/payments/fondy";
import { prisma } from "@/lib/prisma";
import { confirmBookingPaid } from "@/lib/booking/confirmPaid";

export async function POST(req: NextRequest) {
  if (!isFondyConfigured()) {
    return NextResponse.json({ error: "Fondy not configured" }, { status: 500 });
  }

  const ct = req.headers.get("content-type") || "";
  const isJson = ct.includes("application/json");

  let payload: Record<string, any> | null = isJson
    ? ((await req.json().catch(() => null)) as any)
    : null;

  if (payload && typeof (payload as any).response === "object" && (payload as any).response) {
    payload = (payload as any).response as any;
  }

  if (!payload) {
    try {
      const form = await req.formData();
      const obj: Record<string, any> = {};
      for (const [k, v] of form.entries()) obj[String(k)] = typeof v === "string" ? v : String(v);
      payload = obj;

      if (payload && typeof (payload as any).response === "object" && (payload as any).response) {
        payload = (payload as any).response as any;
      }
    } catch {
      return NextResponse.json({ error: "Invalid payload" }, { status: 400 });
    }
  }

  const { signature, ...rest } = payload as any;
  const expected = fondySignature(rest);
  const valid = signature && String(signature).toLowerCase() === expected.toLowerCase();

  // Update booking status if valid
  if (valid && rest.order_id) {
    const orderId = String(rest.order_id);
    const statusRaw = String(rest.order_status || "").toLowerCase();
    let status: "PENDING" | "CONFIRMED" | "COMPLETED" | "CANCELED" | "REFUNDED" = "PENDING";
    if (statusRaw === "approved" || statusRaw === "processing" || statusRaw === "success") status = "CONFIRMED";
    if (statusRaw === "reversed" || statusRaw === "declined" || statusRaw === "expired") status = "CANCELED";
    if (statusRaw === "refunded") status = "REFUNDED";

    try {
      const booking = await prisma.booking.findUnique({ where: { id: orderId }, select: { paymentId: true } }).catch(() => null);
      const paymentId = String((booking as any)?.paymentId || "");
      const isCredits = paymentId.startsWith("credits");
      const isFreeFirst = paymentId === "free_first";
      if (isCredits || isFreeFirst) {
        return NextResponse.json({ ok: valid });
      }

      if (status === "CONFIRMED") {
        await confirmBookingPaid({ bookingId: orderId, provider: "fondy" });
      } else {
        await prisma.booking.update({ where: { id: orderId }, data: { status } });
      }
    } catch {
      // ignore if booking not found
    }
  }

  return NextResponse.json({ ok: valid });
}
