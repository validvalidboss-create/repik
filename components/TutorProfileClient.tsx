"use client";
import { useEffect, useMemo, useState } from "react";
import { usePathname, useSearchParams } from "next/navigation";

function deriveId(pathname: string, sp: URLSearchParams) {
  const parts = pathname.split("/").filter(Boolean);
  const idx = parts.findIndex((p) => p === "tutors");
  const fromPath = idx >= 0 && parts[idx + 1] ? parts[idx + 1] : "";
  const uid = sp.get("uid") || "";
  const qid = sp.get("id") || "";
  return fromPath || uid || qid;
}

export default function TutorProfileClient() {
  const pathname = usePathname();
  const sp = useSearchParams();
  const [idOverride, setIdOverride] = useState<string>("");
  const id = useMemo(() => idOverride || deriveId(pathname || "", sp as any), [pathname, sp, idOverride]);
  const [data, setData] = useState<any>(null);
  const [error, setError] = useState<string>("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    // As a last resort (dev proxies), derive id from window.location
    if (!id && typeof window !== "undefined") {
      try {
        const url = new URL(window.location.href);
        const parts = url.pathname.split("/").filter(Boolean);
        const idx = parts.findIndex((p) => p === "tutors");
        const fromPath = idx >= 0 && parts[idx + 1] ? parts[idx + 1] : "";
        const fallback = fromPath || url.searchParams.get("uid") || url.searchParams.get("id") || "";
        if (fallback) setIdOverride(fallback);
      } catch {}
    }
  }, [id]);

  useEffect(() => {
    if (!id) return;
    let aborted = false;
    setLoading(true);
    fetch(`/api/tutors/${encodeURIComponent(id)}`)
      .then(async (r) => {
        if (!r.ok) throw new Error(`HTTP ${r.status}`);
        return r.json();
      })
      .then((json) => {
        if (!aborted) setData(json);
      })
      .catch((e) => {
        if (!aborted) setError(String(e?.message || e));
      })
      .finally(() => {
        if (!aborted) setLoading(false);
      });
    return () => {
      aborted = true;
    };
  }, [id]);

  if (!id) {
    return (
      <div className="text-sm text-neutral-600">
        Unable to derive id from route. Please check the URL.
      </div>
    );
  }

  if (loading) {
    return <div className="text-sm text-neutral-600">Loading profile…</div>;
  }
  if (error) {
    return (
      <div className="text-sm text-red-600">Failed to load tutor: {error}</div>
    );
  }
  if (!data) return null;

  return (
    <div className="flex flex-col md:flex-row gap-8">
      <div className="text-[11px] text-neutral-500">id: {id}</div>
      <div className="flex-1">
        <div className="mb-6">
          <h1 className="text-3xl font-semibold mb-2">{data?.user?.name ?? data?.name ?? "Tutor"}</h1>
          <div className="flex flex-wrap items-center gap-3 text-sm">
            <div>
              <span className="font-medium">{Number((data?.rating ?? 0) || 0).toFixed(1)}</span> ★
              <span className="text-neutral-500"> · {Number((data?.ratingCount ?? 0) || 0)} reviews</span>
            </div>
            <div className="text-neutral-700">
              {((data?.rateCents ?? 0) / 100).toFixed(0)} {data?.currency} / hour
            </div>
          </div>
        </div>
        <div className="mb-4 flex flex-wrap gap-2">
          {(data?.subjects || []).map((s: string) => (
            <span key={s} className="px-2 py-1 rounded-full border border-neutral-200 text-xs">{s}</span>
          ))}
          {(data?.languages || []).map((l: string) => (
            <span key={l} className="px-2 py-1 rounded-full border border-neutral-200 text-xs text-neutral-500">{l}</span>
          ))}
        </div>
        <section className="mt-6">
          <h2 className="text-lg font-medium mb-2">About</h2>
          <p className="text-neutral-800 leading-6 whitespace-pre-line">{data?.bio || "—"}</p>
        </section>
      </div>
      <aside className="w-full md:w-80">
        <div className="border border-neutral-200 rounded-lg p-4 bg-white sticky top-20">
          <div className="text-2xl font-semibold">{((data?.rateCents ?? 0) / 100).toFixed(0)} {data?.currency}</div>
          <div className="text-sm text-neutral-600 mb-3">per hour</div>
        </div>
      </aside>
    </div>
  );
}
