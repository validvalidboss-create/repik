import { NextRequest } from "next/server";
import { buildFondyPaymentPayload, isFondyConfigured } from "@/lib/payments/fondy";

function escHtml(s: string) {
  return String(s)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/\"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

export async function GET(req: NextRequest) {
  if (!isFondyConfigured()) {
    return new Response("Fondy not configured", { status: 500 });
  }

  const { searchParams } = new URL(req.url);
  const orderId = String(searchParams.get("orderId") || "").trim();
  const amountCents = Number(searchParams.get("amountCents") || "");
  const currency = String(searchParams.get("currency") || "UAH").trim() || "UAH";
  const locale = String(searchParams.get("locale") || "").trim() || "uk";

  if (!orderId || !Number.isFinite(amountCents) || amountCents <= 0) {
    return new Response("Missing orderId or amountCents", { status: 400 });
  }

  const baseUrl = process.env.NEXTAUTH_URL || "http://localhost:3000";
  const payload = buildFondyPaymentPayload({
    order_id: orderId,
    amount: Math.floor(amountCents),
    currency,
    order_desc: `Order ${orderId}`,
    response_url: `${baseUrl}/${encodeURIComponent(locale)}/payment/${encodeURIComponent(orderId)}`,
    server_callback_url: `${baseUrl}/api/payments/fondy/callback`,
  });

  const fondyUrl = "https://pay.fondy.eu/api/checkout/redirect/";

  const inputs = Object.entries(payload)
    .map(([k, v]) => `<input type=\"hidden\" name=\"${escHtml(k)}\" value=\"${escHtml(String(v))}\" />`)
    .join("\n");

  const html = `<!doctype html>
<html>
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>Redirecting to payment…</title>
  </head>
  <body>
    <form id="f" method="POST" action="${escHtml(fondyUrl)}">
      ${inputs}
    </form>
    <script>document.getElementById('f').submit();</script>
  </body>
</html>`;

  return new Response(html, {
    status: 200,
    headers: {
      "Content-Type": "text/html; charset=utf-8",
      "Cache-Control": "no-store",
    },
  });
}
