import crypto from "node:crypto";

const FONDY_MERCHANT_ID = process.env.FONDY_MERCHANT_ID || "";
const FONDY_SECRET = process.env.FONDY_SECRET || "";

export function isFondyConfigured() {
  return !!(FONDY_MERCHANT_ID && FONDY_SECRET);
}

export function fondySignature(data: Record<string, any>) {
  const sorted = Object.keys(data)
    .sort()
    .reduce((acc, key) => ({ ...acc, [key]: data[key] }), {} as Record<string, any>);
  const base = Object.values(sorted).join("|");
  return crypto.createHash("sha1").update(`${FONDY_SECRET}|${base}`).digest("hex");
}

export function buildFondyPaymentPayload(params: {
  order_id: string;
  amount: number; // in minor units
  currency: string;
  order_desc: string;
  response_url: string;
  server_callback_url: string;
}) {
  const payload = {
    merchant_id: FONDY_MERCHANT_ID,
    order_id: params.order_id,
    amount: params.amount,
    currency: params.currency,
    order_desc: params.order_desc,
    response_url: params.response_url,
    server_callback_url: params.server_callback_url,
  } as const;
  const signature = fondySignature(payload as any);
  return { ...payload, signature };
}
