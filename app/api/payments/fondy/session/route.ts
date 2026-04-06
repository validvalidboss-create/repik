import { NextRequest } from "next/server";

const { FONDY_MERCHANT_ID, FONDY_SECRET, PUBLIC_BASE_URL } = process.env;

export async function POST(req: NextRequest) {
  try {
    const { bookingId, amountCents, currency = "UAH" } = await req.json();
    if (!bookingId || !amountCents) return Response.json({ error: "bookingId and amountCents required" }, { status: 400 });

    // Minimal placeholder: normally you'd sign params with FONDY_SECRET
    const returnUrl = `${PUBLIC_BASE_URL || "http://localhost:3000"}/api/payments/fondy/return?bookingId=${encodeURIComponent(
      bookingId
    )}`;
    const callbackUrl = `${PUBLIC_BASE_URL || "http://localhost:3000"}/api/webhooks/fondy`;

    const mockUrl = `https://pay.fondy.eu/sandbox/mock?merchant_id=${encodeURIComponent(
      FONDY_MERCHANT_ID || ""
    )}&order_id=${encodeURIComponent(bookingId)}&amount=${amountCents}&currency=${currency}&response_url=${encodeURIComponent(
      returnUrl
    )}&server_callback_url=${encodeURIComponent(callbackUrl)}`;

    return Response.json({ url: mockUrl });
  } catch (e: any) {
    return Response.json({ error: e?.message || "Server error" }, { status: 500 });
  }
}
