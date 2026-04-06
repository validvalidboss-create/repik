"use client";

import * as React from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";

export default function ChatStartPage() {
  const router = useRouter();
  const pathname = usePathname();
  const sp = useSearchParams();

  const [err, setErr] = React.useState<string | null>(null);

  React.useEffect(() => {
    let mounted = true;

    async function run() {
      try {
        setErr(null);
        const tutorId = String(sp?.get("tutorId") || "").trim();
        const locale = pathname?.split("/")?.[1] || "uk";

        if (!tutorId) {
          setErr("Missing tutorId");
          return;
        }

        const res = await fetch("/api/chat/start", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ tutorId }),
        });

        const data = await res.json().catch(() => ({} as any));

        if (res.status === 401) {
          const next = `/${locale}/chat/start?tutorId=${encodeURIComponent(tutorId)}`;
          router.replace(`/${locale}/sign-in?next=${encodeURIComponent(next)}`);
          return;
        }

        if (!res.ok) throw new Error(data?.error || "Failed to start chat");
        if (!data?.bookingId) throw new Error("No bookingId returned");

        const href = `/${locale}/chat/${encodeURIComponent(String(data.bookingId))}`;
        if (typeof window !== "undefined") {
          window.location.href = href;
        } else {
          router.replace(href);
        }
      } catch (e) {
        if (!mounted) return;
        setErr((e as Error).message);
      }
    }

    run();

    return () => {
      mounted = false;
    };
  }, [router, sp, pathname]);

  return (
    <main className="container mx-auto px-4 py-12">
      <div className="text-sm text-neutral-600">Відкриваємо чат…</div>
      {err ? <div className="mt-2 text-sm text-red-600">{err}</div> : null}
    </main>
  );
}
