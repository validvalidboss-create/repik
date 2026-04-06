"use client";

import { Heart } from "lucide-react";
import { useEffect, useMemo, useState } from "react";

export default function FavoriteTutorButton({ tutorId, locale }: { tutorId: string; locale?: string }) {
  const [liked, setLiked] = useState(false);
  const [loading, setLoading] = useState(true);
  const [pending, setPending] = useState(false);
  const [burst, setBurst] = useState(0);
  const [error, setError] = useState<string>("");

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const tid = String(tutorId || "").trim();
      if (!tid) {
        setLiked(false);
        setLoading(false);
        setError("Не вдалося визначити викладача (tutorId)");
        return;
      }
      setLoading(true);
      setError("");
      try {
        const res = await fetch(`/api/favorites/${encodeURIComponent(String(tid))}`, { cache: "no-store" });
        const data = await res.json().catch(() => null);
        if (cancelled) return;
        if (res.ok) setLiked(!!data?.liked);
        else if (res.status !== 401) setError(String(data?.error || "Не вдалося завантажити обране"));
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [tutorId]);

  const label = pending ? "…" : liked ? "Додано" : "В обрані";

  const particles = useMemo(() => {
    const out: Array<{ x: number; y: number; d: number }> = [];
    for (let i = 0; i < 8; i++) {
      const a = (Math.PI * 2 * i) / 8;
      out.push({ x: Math.cos(a), y: Math.sin(a), d: i * 0.03 });
    }
    return out;
  }, []);

  async function toggle() {
    if (loading || pending) return;
    const tid = String(tutorId || "").trim();
    if (!tid) {
      setError("Не вдалося визначити викладача (tutorId)");
      return;
    }

    setError("");

    const nextLiked = !liked;
    setPending(true);
    try {
      const res = await fetch(`/api/favorites/${encodeURIComponent(String(tid))}`, {
        method: nextLiked ? "POST" : "DELETE",
        headers: { "content-type": "application/json" },
      });
      const data = await res.json().catch(() => null);
      if (!res.ok) {
        if (res.status === 401) {
          setError("Увійдіть, щоб додавати в обрані");
          const loc = String(locale || "").trim();
          setTimeout(() => {
            window.location.href = loc ? `/${encodeURIComponent(loc)}/sign-in` : "/sign-in";
          }, 350);
          return;
        }
        setError(String(data?.error || "Не вдалося оновити обране"));
        return;
      }

      const serverLiked = typeof data?.liked === "boolean" ? !!data.liked : nextLiked;
      setLiked(serverLiked);
      if (serverLiked) setBurst((v) => v + 1);

      try {
        if (typeof window !== "undefined") {
          window.sessionStorage?.setItem("favoritesDirty", "1");
          window.dispatchEvent(new Event("favorites-changed"));
        }
      } catch {
        // ignore
      }
    } finally {
      setPending(false);
    }
  }

  return (
    <div className="relative">
      <button
        type="button"
        onClick={toggle}
        disabled={loading || pending}
        className={
          "w-full px-4 py-2.5 rounded-xl border text-sm hover:bg-neutral-50 inline-flex items-center justify-center gap-2 transition-colors " +
          (liked
            ? "border-emerald-200 bg-emerald-50 text-emerald-900"
            : "border-neutral-200 bg-white text-neutral-900") +
          (loading || pending ? " opacity-60" : "")
        }
        aria-pressed={liked}
      >
        <span className={liked ? "text-emerald-700" : "text-neutral-700"}>
          <Heart className="h-4 w-4" fill={liked ? "currentColor" : "none"} />
        </span>
        <span>{label}</span>
      </button>

      {error ? <div className="mt-1 text-xs text-red-700">{error}</div> : null}

      {burst ? (
        <div key={burst} className="pointer-events-none absolute inset-0">
          {particles.map((p, idx) => (
            <span
              key={idx}
              className="fav-burst"
              style={{
                left: "50%",
                top: "50%",
                transform: `translate(-50%, -50%) translate(${p.x * 0}px, ${p.y * 0}px)`,
                animationDelay: `${p.d}s`,
                ['--dx' as any]: `${p.x * 44}px`,
                ['--dy' as any]: `${p.y * 44}px`,
              }}
            />
          ))}
        </div>
      ) : null}

      <style jsx>{`
        .fav-burst {
          position: absolute;
          width: 6px;
          height: 6px;
          border-radius: 999px;
          background: rgba(16, 185, 129, 0.9);
          animation: fav-pop 520ms ease-out forwards;
        }
        @keyframes fav-pop {
          0% {
            opacity: 0;
            transform: translate(-50%, -50%) scale(0.6);
          }
          10% {
            opacity: 1;
          }
          100% {
            opacity: 0;
            transform: translate(-50%, -50%) translate(var(--dx), var(--dy)) scale(1);
          }
        }
      `}</style>
    </div>
  );
}
