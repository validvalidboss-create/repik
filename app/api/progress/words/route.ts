import { NextRequest } from "next/server";

let store: Array<{ id: string; word: string; lang: string; addedAt: string }>=[];

export async function GET() {
  return Response.json({ items: store });
}

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({}));
  const { word, lang = "en" } = body || {};
  if (!word) return Response.json({ error: "Missing word" }, { status: 400 });
  const id = `${word}-${Date.now()}`;
  const item = { id, word, lang, addedAt: new Date().toISOString() };
  store.unshift(item);
  store = store.slice(0, 200);
  return Response.json({ ok: true, item });
}
