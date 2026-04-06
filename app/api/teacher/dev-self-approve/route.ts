import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function replaceStatusTrack(tracks: string[], status: string): string[] {
  const base = tracks.filter((t) => !String(t).startsWith("status:"));
  return [...base, `status:${status}`];
}

export async function POST(_req: NextRequest) {
  if (process.env.NODE_ENV === "production") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const session = await auth();
  const user = session?.user as any;
  if (!user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const tutor = await prisma.tutor.findUnique({ where: { userId: String(user.id) }, select: { id: true, tracks: true } });
  if (!tutor?.id) return NextResponse.json({ error: "Tutor profile not found" }, { status: 404 });

  const currentTracks: string[] = Array.isArray(tutor.tracks) ? (tutor.tracks as string[]).map(String) : [];
  const nextTracks = replaceStatusTrack(currentTracks, "active");

  try {
    const updated = await (prisma as any).tutor.update({
      where: { id: tutor.id },
      data: { tracks: nextTracks, moderationNote: null },
      select: { id: true, tracks: true },
    });
    const url = new URL(_req.url);
    const ref = _req.headers.get("referer");
    const redirectTo = ref ? ref : `${url.origin}/uk/profile`;
    return NextResponse.redirect(redirectTo);
  } catch (e: any) {
    const msg = String(e?.message || "");
    if (msg.includes("Unknown argument `moderationNote`")) {
      const updated = await prisma.tutor.update({
        where: { id: tutor.id },
        data: { tracks: nextTracks },
        select: { id: true, tracks: true },
      });
      try {
        await prisma.$executeRaw`
          UPDATE "Tutor"
          SET "moderationNote" = NULL
          WHERE "id" = ${tutor.id}
        `;
      } catch {
        // ignore
      }
      const url = new URL(_req.url);
      const ref = _req.headers.get("referer");
      const redirectTo = ref ? ref : `${url.origin}/uk/profile`;
      return NextResponse.redirect(redirectTo);
    }
    throw e;
  }
}
