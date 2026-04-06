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

  try {
    const lb = (prisma as any).lessonBalance;
    if (!lb?.updateMany) throw new Error("LESSON_BALANCE_NOT_CONFIGURED");

    const res = await lb.updateMany({
      where: { studentId: userId },
      data: { credits: 0 },
    });

    try {
      // also reset trial credits only if explicitly asked
      const body = await req.json().catch(() => null);
      const resetTrial = !!body?.resetTrial;
      if (resetTrial) {
        const tb = (prisma as any).trialBalance;
        if (tb?.updateMany) {
          await tb.updateMany({ where: { studentId: userId }, data: { credits: 0 } });
        }
      }
    } catch {
      // ignore
    }

    return NextResponse.json({ ok: true, userId, updated: Number(res?.count || 0) });
  } catch (e: any) {
    const msg = e instanceof Error ? e.message : "Server error";
    return NextResponse.json({ ok: false, error: msg }, { status: 500 });
  }
}
