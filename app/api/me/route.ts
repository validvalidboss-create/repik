import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET() {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ user: null });
  const viewer = session.user as any;
  const adminEmail = (process.env.ADMIN_EMAIL || "").trim();
  const isAdmin =
    !!adminEmail && !!viewer?.email && String(viewer.email).toLowerCase() === String(adminEmail).toLowerCase();
  return NextResponse.json({ user: session.user, isAdmin });
}
