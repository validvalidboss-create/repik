import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";

export async function POST(req: NextRequest) {
  const session = await auth();
  const user = session?.user as any;
  if (!user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json().catch(() => null);
  if (!body) return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });

  const {
    bio = "",
    headline = "",
    rateCents = 0,
    currency = "UAH",
    languages = [] as string[],
    subjects = [] as string[],
  } = body as any;

  const userId = String(user.id);

  const existing = await prisma.tutor.findUnique({ where: { userId } });
  const tutor = existing
    ? await prisma.tutor.update({
        where: { userId },
        data: { bio, headline, rateCents: Number(rateCents) || 0, currency, languages, subjects },
      })
    : await prisma.tutor.create({
        data: { userId, bio, headline, rateCents: Number(rateCents) || 0, currency, languages, subjects },
      });

  return NextResponse.json({ ok: true, tutor });
}
