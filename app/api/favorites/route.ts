import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  try {
    const session = await auth();
    const userId = session?.user ? String((session.user as any).id || "") : "";
    if (!userId) return Response.json({ error: "Unauthorized" }, { status: 401 });

    const { searchParams } = new URL(req.url);
    const wantsCount = searchParams.get("count") === "1";
    if (wantsCount) {
      const count = await prisma.favorite.count({ where: { userId } });
      return Response.json({ count });
    }

    const items = await prisma.favorite.findMany({
      where: { userId },
      include: { tutor: true },
      orderBy: { createdAt: "desc" },
    });
    return Response.json({ items });
  } catch (e: any) {
    return Response.json({ error: e?.message || "Server error" }, { status: 500 });
  }
}
