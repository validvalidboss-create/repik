import { NextResponse } from "next/server";
import crypto from "node:crypto";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  const form = await req.formData();
  const file = form.get("file");
  if (!file || !(file instanceof Blob)) {
    return NextResponse.json({ error: "No file" }, { status: 400 });
  }

  const cloudName = process.env.CLOUDINARY_CLOUD_NAME;
  const uploadPreset = process.env.CLOUDINARY_UPLOAD_PRESET;
  const apiKey = process.env.CLOUDINARY_API_KEY;
  const apiSecret = process.env.CLOUDINARY_API_SECRET;
  if (!cloudName || (!uploadPreset && !(apiKey && apiSecret))) {
    return NextResponse.json(
      {
        error: "Cloudinary is not configured",
        details:
          "Set CLOUDINARY_CLOUD_NAME + CLOUDINARY_UPLOAD_PRESET (unsigned) or CLOUDINARY_CLOUD_NAME + CLOUDINARY_API_KEY + CLOUDINARY_API_SECRET (signed).",
        env: {
          CLOUDINARY_CLOUD_NAME: Boolean(cloudName),
          CLOUDINARY_UPLOAD_PRESET: Boolean(uploadPreset),
          CLOUDINARY_API_KEY: Boolean(apiKey),
          CLOUDINARY_API_SECRET: Boolean(apiSecret),
        },
      },
      { status: 500 },
    );
  }

  const cloudinaryUrl = `https://api.cloudinary.com/v1_1/${cloudName}/auto/upload`;
  const fd = new FormData();
  fd.append("file", file);

  if (uploadPreset) {
    fd.append("upload_preset", uploadPreset);
  } else {
    const timestamp = Math.floor(Date.now() / 1000);
    const signatureBase = `timestamp=${timestamp}${apiSecret}`;
    const signature = crypto.createHash("sha1").update(signatureBase).digest("hex");
    fd.append("api_key", apiKey as string);
    fd.append("timestamp", String(timestamp));
    fd.append("signature", signature);
  }

  const res = await fetch(cloudinaryUrl, {
    method: "POST",
    body: fd,
  });

  if (!res.ok) {
    const text = await res.text();
    return NextResponse.json({ error: "Upload failed", details: text }, { status: 500 });
  }

  const data = await res.json() as any;
  return NextResponse.json({ url: data.secure_url || data.url, publicId: data.public_id });
}
