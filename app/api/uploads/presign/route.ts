import { NextResponse } from "next/server";

// Minimal presign stub. When S3/R2 is configured via env, we will return a real
// presigned URL. Until then, the endpoint responds with disabled=true so the
// client uploader can hide upload controls.

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function storageConfigured() {
  return (
    !!process.env.S3_ENDPOINT &&
    !!process.env.S3_BUCKET &&
    !!process.env.S3_ACCESS_KEY_ID &&
    !!process.env.S3_SECRET_ACCESS_KEY
  );
}

export async function POST(req: Request) {
  try {
    const contentType = req.headers.get("content-type") || "";
    if (!contentType.includes("application/json")) {
      return NextResponse.json({ error: "Invalid content type" }, { status: 400 });
    }
    const body = await req.json();
    const { filename, type } = body || {};

    if (!filename || !type) {
      return NextResponse.json({ error: "filename and type are required" }, { status: 400 });
    }

    if (!storageConfigured()) {
      return NextResponse.json(
        {
          disabled: true,
          reason: "Storage is not configured. Set S3_* env vars to enable uploads.",
          // Provide a predictable placeholder URL for local dev previews (no upload)
          previewUrl: `${process.env.NEXT_PUBLIC_STORAGE_PUBLIC_URL || "https://cdn.localhost/repetitir-dev"}/placeholders/${encodeURIComponent(
            filename
          )}`,
        },
        { status: 200 }
      );
    }

    // TODO: Implement AWS S3/R2 SigV4 presign here (POST policy or PUT URL)
    // For now return a 503 to indicate not yet implemented even if env present
    return NextResponse.json(
      { error: "Presign not yet implemented. Will return PUT URL and headers." },
      { status: 503 }
    );
  } catch (e) {
    return NextResponse.json(
      { error: "Unexpected error", details: (e as Error).message },
      { status: 500 }
    );
  }
}
