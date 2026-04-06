import { NextResponse } from "next/server";
import crypto from "node:crypto";
import fs from "node:fs/promises";
import path from "node:path";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const MAX_BYTES = 25 * 1024 * 1024;

function safeExtFromName(name: string) {
  const base = String(name || "");
  const ext = path.extname(base).toLowerCase();
  if (!ext) return "";
  if (!/^\.[a-z0-9]{1,8}$/.test(ext)) return "";
  return ext;
}

export async function POST(req: Request) {
  try {
    const form = await req.formData();
    const file = form.get("file");
    if (!file || !(file instanceof Blob)) {
      return NextResponse.json({ error: "No file" }, { status: 400 });
    }

    const size = Number((file as any).size || 0);
    if (Number.isFinite(size) && size > MAX_BYTES) {
      return NextResponse.json({ error: "File too large" }, { status: 413 });
    }

    const originalName = typeof (file as any).name === "string" ? String((file as any).name) : "upload";
    const ext = safeExtFromName(originalName) || ".bin";

    const bytes = Buffer.from(await file.arrayBuffer());
    if (bytes.length > MAX_BYTES) {
      return NextResponse.json({ error: "File too large" }, { status: 413 });
    }

    const dirAbs = path.join(process.cwd(), "public", "uploads");
    await fs.mkdir(dirAbs, { recursive: true });

    const id = crypto.randomBytes(16).toString("hex");
    const filename = `${Date.now()}_${id}${ext}`;
    const abs = path.join(dirAbs, filename);
    await fs.writeFile(abs, bytes);

    const url = `/uploads/${encodeURIComponent(filename)}`;
    return NextResponse.json({ ok: true, url, size: bytes.length });
  } catch (e) {
    return NextResponse.json(
      { error: "Upload failed", details: e instanceof Error ? e.message : String(e) },
      { status: 500 }
    );
  }
}
