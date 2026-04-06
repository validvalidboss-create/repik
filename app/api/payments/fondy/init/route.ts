import { NextRequest, NextResponse } from "next/server";
import { buildFondyPaymentPayload, isFondyConfigured } from "@/lib/payments/fondy";

export async function POST(req: NextRequest) {
  if (!isFondyConfigured()) {
    return NextResponse.json({ error: "Fondy not configured" }, { status: 500 });
  }

  const body = await req.json().catch(() => null);
  if (!body) return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });

  const { orderId, amountCents, currency = "UAH" } = body as {
    orderId: string;
    amountCents: number;
    currency?: string;
  };
  if (!orderId || !amountCents) {
    return NextResponse.json({ error: "Missing orderId or amountCents" }, { status: 400 });
  }

  const baseUrl = process.env.NEXTAUTH_URL || "http://localhost:3000";
  const payload = buildFondyPaymentPayload({
    order_id: orderId,
    amount: amountCents,
    currency,
    order_desc: `Booking ${orderId}`,
    response_url: `${baseUrl}/payment/${orderId}`,
    server_callback_url: `${baseUrl}/api/payments/fondy/callback`,
  });

  return NextResponse.json({ ok: true, payload });
}
