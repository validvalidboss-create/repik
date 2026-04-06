import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";

function randSlug(len = 6) {
  const chars = "abcdefghijklmnopqrstuvwxyz0123456789";
  let out = "";
  for (let i = 0; i < len; i++) out += chars[Math.floor(Math.random() * chars.length)];
  return out;
}

function randInt(min: number, max: number) {
  const a = Math.min(min, max);
  const b = Math.max(min, max);
  return Math.floor(a + Math.random() * (b - a + 1));
}

export async function POST(req: NextRequest) {
  if (process.env.NODE_ENV === "production") {
    return NextResponse.json({ ok: false, error: "Not available" }, { status: 404 });
  }

  const { searchParams } = new URL(req.url);
  const token = String(searchParams.get("token") || "").trim();
  const seedToken = String(process.env.DEV_SEED_TOKEN || "dev").trim();
  const tokenOk = !!seedToken && token === seedToken;

  const session = await auth();
  const userId = session?.user ? String((session.user as any).id || "") : "";
  if (!userId && !tokenOk) return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });

  const body = await req.json().catch(() => ({}));
  const count = Math.max(1, Math.min(50, Math.trunc(Number((body as any)?.count ?? 10) || 10)));
  const countFreeFirstRaw = Number((body as any)?.countFreeFirst);
  const countRegularRaw = Number((body as any)?.countRegular);
  const countFreeFirst = Number.isFinite(countFreeFirstRaw) ? Math.max(0, Math.min(50, Math.trunc(countFreeFirstRaw))) : count;
  const countRegular = Number.isFinite(countRegularRaw) ? Math.max(0, Math.min(50, Math.trunc(countRegularRaw))) : 0;
  const freeFirst = (body as any)?.freeFirst === false ? false : true;
  const minPriceUAH = Math.max(100, Math.min(2000, Math.trunc(Number((body as any)?.minPriceUAH ?? 250) || 250)));
  const maxPriceUAH = Math.max(minPriceUAH, Math.min(5000, Math.trunc(Number((body as any)?.maxPriceUAH ?? 900) || 900)));

  try {
    const created: Array<{ tutorId: string; userId: string; email: string; name: string }> = [];
    const makeOne = async (idx: number, makeFreeFirst: boolean) => {
      const slug = randSlug(8);
      const email = `dev.tutor.${slug}@example.com`;
      const name = makeFreeFirst ? `Dev Tutor Free ${idx + 1}` : `Dev Tutor ${idx + 1}`;
      const priceUAH = randInt(minPriceUAH, maxPriceUAH);
      const rateCents = priceUAH * 100;
      const rate30 = Math.max(0, Math.round(rateCents / 2));

      const user = await prisma.user.create({
        data: {
          email,
          name,
          role: "TUTOR" as any,
          locale: "uk" as any,
        },
        select: { id: true },
      });

      const tutor = await prisma.tutor.create({
        data: {
          userId: user.id,
          bio: "",
          headline: "",
          rateCents,
          currency: "UAH",
          languages: ["uk"],
          subjects: ["english"],
          tracks: makeFreeFirst && freeFirst ? ["status:active", "freefirst:true", `rate30:${rate30}`] : ["status:active"],
        },
        select: { id: true },
      });

      created.push({ tutorId: String(tutor.id), userId: String(user.id), email, name });
    };

    if (countRegular > 0 || countFreeFirst !== count) {
      for (let i = 0; i < countFreeFirst; i++) await makeOne(i, true);
      for (let i = 0; i < countRegular; i++) await makeOne(i, false);
    } else {
      for (let i = 0; i < count; i++) await makeOne(i, true);
    }

    return NextResponse.json({ ok: true, count: created.length, items: created });
  } catch (e: any) {
    const msg = e instanceof Error ? e.message : "Server error";
    return NextResponse.json({ ok: false, error: msg }, { status: 500 });
  }
}
