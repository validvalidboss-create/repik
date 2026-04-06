import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

function getStatusFromTracks(tracks: unknown): string {
  const list: string[] = Array.isArray(tracks) ? (tracks as string[]).map(String) : [];
  const raw = list.find((t) => t.startsWith("status:"));
  return raw ? raw.replace("status:", "") : "draft";
}

function replaceStatusTrack(tracks: string[], status: string): string[] {
  const base = tracks.filter((t) => !t.startsWith("status:"));
  return [...base, `status:${status}`];
}

export async function POST(req: Request) {
  const session = await auth();
  const user = session?.user as any;
  if (!user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json().catch(() => ({}));
  const action = String(body?.action || "").trim();
  if (!action) return NextResponse.json({ error: "Missing action" }, { status: 400 });

  const tutor = await prisma.tutor.findFirst({ where: { userId: String(user.id) } });
  if (!tutor) return NextResponse.json({ error: "Tutor profile not found" }, { status: 404 });

  const currentTracks: string[] = Array.isArray((tutor as any).tracks) ? ((tutor as any).tracks as string[]) : [];
  const currentStatus = getStatusFromTracks(currentTracks);

  if (action === "pause") {
    if (currentStatus !== "active") {
      return NextResponse.json({ error: "Can pause only active listing" }, { status: 409 });
    }
    const nextTracks = replaceStatusTrack(currentTracks, "paused");
    await prisma.tutor.update({ where: { id: tutor.id }, data: { tracks: nextTracks } });
    return NextResponse.json({ ok: true, status: "paused" });
  }

  if (action === "deactivate") {
    if (currentStatus !== "active" && currentStatus !== "paused") {
      return NextResponse.json({ error: "Can deactivate only active/paused listing" }, { status: 409 });
    }
    const nextTracks = replaceStatusTrack(currentTracks, "draft");
    await prisma.tutor.update({ where: { id: tutor.id }, data: { tracks: nextTracks } });
    return NextResponse.json({ ok: true, status: "draft" });
  }

  if (action === "activate") {
    if (currentStatus !== "paused" && currentStatus !== "draft") {
      return NextResponse.json({ error: "Can activate only paused/draft listing" }, { status: 409 });
    }
    const nextTracks = replaceStatusTrack(currentTracks, "active");
    await prisma.tutor.update({ where: { id: tutor.id }, data: { tracks: nextTracks } });
    return NextResponse.json({ ok: true, status: "active" });
  }

  return NextResponse.json({ error: "Unknown action" }, { status: 400 });
}
