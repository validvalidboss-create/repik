import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";

export const dynamic = "force-dynamic";

export async function GET(_req: NextRequest, { params }: { params: Promise<{ tutorId: string }> }) {
  try {
    const session = await auth();
    const user: any = session?.user as any;
    const userId = user?.id ? String(user.id) : "";
    const { tutorId: tutorIdParam } = await params;
    const tutorId = String(tutorIdParam || "");
    if (!userId) return Response.json({ error: "Unauthorized" }, { status: 401 });
    if (!tutorId) return Response.json({ error: "tutorId required" }, { status: 400 });

    const fav = await prisma.favorite.findUnique({ where: { userId_tutorId: { userId, tutorId } }, select: { id: true } });
    return Response.json({ liked: !!fav });
  } catch (e: any) {
    return Response.json({ error: e?.message || "Server error" }, { status: 500 });
  }
}

export async function POST(req: NextRequest, { params }: { params: Promise<{ tutorId: string }> }) {
  try {
    const session = await auth();
    const user: any = session?.user as any;
    const userId = user?.id ? String(user.id) : "";
    const { tutorId } = await params;
    if (!userId) return Response.json({ error: "Unauthorized" }, { status: 401 });
    if (!tutorId) return Response.json({ error: "tutorId required" }, { status: 400 });
    const fav = await prisma.favorite.upsert({
      where: { userId_tutorId: { userId, tutorId } },
      create: { userId, tutorId },
      update: {},
    });
    return Response.json({ favorite: fav, liked: true });
  } catch (e: any) {
    return Response.json({ error: e?.message || "Server error" }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ tutorId: string }> }) {
  try {
    const session = await auth();
    const user: any = session?.user as any;
    const userId = user?.id ? String(user.id) : "";
    const { tutorId } = await params;
    if (!userId) return Response.json({ error: "Unauthorized" }, { status: 401 });
    if (!tutorId) return Response.json({ error: "tutorId required" }, { status: 400 });
    await prisma.favorite.deleteMany({ where: { userId, tutorId } });
    return Response.json({ ok: true, liked: false });
  } catch (e: any) {
    return Response.json({ error: e?.message || "Server error" }, { status: 500 });
  }
}
