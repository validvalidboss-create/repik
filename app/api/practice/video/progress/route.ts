import { NextRequest } from "next/server";

let PROGRESS: Record<string, any> = {};

export async function POST(req: NextRequest) {
  const body = await req.json();
  const { videoId, progress } = body || {};
  if (!videoId) return Response.json({ error: "videoId required" }, { status: 400 });
  PROGRESS[videoId] = { ...(PROGRESS[videoId] || {}), ...progress };
  return Response.json({ ok: true, saved: PROGRESS[videoId] });
}

export async function GET(_req: NextRequest) {
  return Response.json({ progress: PROGRESS });
}
