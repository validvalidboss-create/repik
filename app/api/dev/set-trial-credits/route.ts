import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";

export async function POST(req: NextRequest) {
  if (process.env.NODE_ENV === "production") {
    return NextResponse.json({ ok: false, error: "Not available" }, { status: 404 });
  }

  const { searchParams } = new URL(req.url);
  const token = String(searchParams.get("token") || "").trim();
  const seedToken = String(process.env.DEV_SEED_TOKEN || "dev").trim();
  const tokenOk = !!seedToken && token === seedToken;

  const session = await auth();
  const authedUserId = session?.user ? String((session.user as any).id || "") : "";

  const userId = authedUserId
    ? authedUserId
    : tokenOk
      ? await (async () => {
          const u = await prisma.user
            .findFirst({
              where: { role: { not: "TUTOR" as any } },
              select: { id: true },
              orderBy: { createdAt: "desc" },
            })
            .catch(() => null);
          return u?.id ? String(u.id) : "";
        })()
      : "";

  if (!userId) return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });

  const body = await req.json().catch(() => null);
  const credits = Math.max(0, Math.min(10, Math.trunc(Number(body?.credits))));

  try {
    const tb = (prisma as any).trialBalance;
    if (!tb?.upsert) throw new Error("TRIAL_BALANCE_NOT_CONFIGURED");

    const row = await tb.upsert({
      where: { studentId: userId },
      create: { studentId: userId, credits },
      update: { credits },
      select: { credits: true },
    });

    return NextResponse.json({ ok: true, userId, credits: Number(row?.credits ?? 0) || 0 });
  } catch (e: any) {
    const msg = e instanceof Error ? e.message : "Server error";
    return NextResponse.json({ ok: false, error: msg }, { status: 500 });
  }
}
