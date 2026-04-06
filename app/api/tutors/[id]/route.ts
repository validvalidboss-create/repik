import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { MOCK_TUTORS } from "@/mocks/tutors";
import { auth } from "@/lib/auth";

function decodeRate30Cents(tracks: unknown): number | null {
  const list: string[] = Array.isArray(tracks) ? (tracks as any[]).map((t) => String(t)) : [];
  const raw = list.find((t) => t.startsWith("rate30:"));
  if (!raw) return null;
  const n = Number(raw.replace("rate30:", "").trim());
  if (!Number.isFinite(n) || n < 0) return null;
  return Math.floor(n);
}

function decodeDescTracks(tracks: unknown): string {
  const list: string[] = Array.isArray(tracks) ? (tracks as any[]).map((t) => String(t)) : [];
  const pick = (prefix: string) => {
    const raw = list.find((t) => t.startsWith(prefix));
    if (!raw) return "";
    const encoded = raw.slice(prefix.length);
    try {
      return decodeURIComponent(encoded);
    } catch {
      return encoded;
    }
  };

  const intro = pick("desc:intro:").trim();
  const exp = pick("desc:experience:").trim();
  const mot = pick("desc:motivate:").trim();
  const parts = [intro, exp, mot].filter(Boolean);
  return parts.join("\n\n").trim();
}

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const url = new URL(_req.url);
  const parts = url.pathname.split("/").filter(Boolean);
  const idx = parts.findIndex((p) => p === "api");
  // /api/tutors/[id]
  const fromPath = (() => {
    const i = parts.findIndex((p) => p === "tutors");
    return i >= 0 && parts[i + 1] ? parts[i + 1] : "";
  })();
  const fromQuery = url.searchParams.get("id") || url.searchParams.get("uid") || "";
  const resolvedParams: any = typeof (params as any)?.then === "function" ? await (params as any) : params;
  const id = (resolvedParams?.id || fromPath || fromQuery || "").trim();
  if (!id) return NextResponse.json({ error: "Missing id" }, { status: 400 });

  // Serve mock tutors for demo ids
  if (id.startsWith("mock-")) {
    const slug = id.replace(/^mock-/, "");
    const mt = MOCK_TUTORS.find((t) => t.slug === slug);
    if (!mt) return NextResponse.json({ error: "Mock tutor not found" }, { status: 404 });
    return NextResponse.json({
      id,
      userId: id,
      user: { name: mt.name },
      subjects: mt.subjects,
      languages: mt.languages,
      rateCents: mt.rateCents,
      currency: mt.currency,
      rating: mt.rating,
      ratingCount: mt.ratingCount,
      bio: mt.bio,
    });
  }

  let tutor = await prisma.tutor.findFirst({
    where: { OR: [{ id }, { userId: id }] },
    include: { user: true, availability: true },
  });
  if (!tutor && id) {
    const user = await prisma.user.findUnique({ where: { id } });
    if (user) {
      tutor = await prisma.tutor.create({
        data: {
          userId: user.id,
          bio: "",
          headline: "",
          rateCents: 30000,
          currency: "UAH",
          languages: [user.locale || "uk"],
          subjects: ["english"],
        },
        include: { user: true, availability: true },
      });
    }
  }
  if (!tutor) return NextResponse.json({ error: "Tutor not found" }, { status: 404 });

  const derivedBio = !String((tutor as any).bio || "").trim() ? decodeDescTracks((tutor as any).tracks) : "";
  const rate30Cents = decodeRate30Cents((tutor as any).tracks);

  return NextResponse.json({
    id: tutor.id,
    name: tutor.user?.name ?? "Tutor",
    headline: tutor.headline,
    rateCents: tutor.rateCents,
    rate30Cents,
    currency: tutor.currency,
    subjects: tutor.subjects,
    languages: tutor.languages,
    bio: derivedBio || tutor.bio,
    user: tutor.user,
    rating: tutor.rating,
    ratingCount: tutor.ratingCount,
    videoUrl: (tutor as any).videoUrl || null,
    media: Array.isArray((tutor as any).media) ? (tutor as any).media : [],
    availability: Array.isArray((tutor as any).availability) ? (tutor as any).availability : [],
  });
}

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  const sessUser: any = session?.user as any;
  if (!sessUser?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const userId = String(sessUser.id);
  const resolvedParams: any = typeof (params as any)?.then === "function" ? await (params as any) : params;
  const pid = String(resolvedParams?.id || "");
  const tutor = await prisma.tutor.findFirst({ where: { OR: [{ id: pid }, { userId: pid }] } });
  if (!tutor) return NextResponse.json({ error: "Tutor not found" }, { status: 404 });
  if (tutor.userId !== userId) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  let body: any;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const data: any = {};
  if (typeof body.headline === "string") data.headline = body.headline.slice(0, 180);
  if (typeof body.bio === "string") data.bio = body.bio.slice(0, 4000);
  if (typeof body.currency === "string" && body.currency.length <= 8) data.currency = body.currency;
  if (typeof body.rateCents !== "undefined") {
    const rc = Number(body.rateCents);
    if (!Number.isFinite(rc) || rc < 0) return NextResponse.json({ error: "Invalid rateCents" }, { status: 400 });
    data.rateCents = Math.floor(rc);
  }
  if (Array.isArray(body.subjects)) data.subjects = body.subjects.filter((x: any) => typeof x === "string").slice(0, 32);
  if (Array.isArray(body.languages)) data.languages = body.languages.filter((x: any) => typeof x === "string").slice(0, 16);
  if (typeof body.videoUrl === "string") data.videoUrl = body.videoUrl;
  if (Array.isArray(body.media)) data.media = body.media.filter((x: any) => typeof x === "string").slice(0, 12);

  const updated = await prisma.tutor.update({ where: { id: tutor.id }, data, include: { user: true } });
  return NextResponse.json(updated);
}
