"use client";
import { useState } from "react";

export default function ChatStartButton({
  tutorId,
  locale,
  label = "💬",
  className,
  wrapperClassName,
}: {
  tutorId: string;
  locale: string;
  label?: string;
  className?: string;
  wrapperClassName?: string;
}) {
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  async function handle() {
    setErr(null);
    setLoading(true);
    try {
      const res = await fetch("/api/chat/start", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ tutorId }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error || "Failed to start chat");
      if (!data?.bookingId) throw new Error("No bookingId returned");
      window.location.href = `/${locale}/chat/${encodeURIComponent(data.bookingId)}`;
    } catch (e) {
      setErr((e as Error).message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className={wrapperClassName || "inline-flex flex-col items-center"}>
      <button
        onClick={handle}
        disabled={loading}
        className={className || "px-3 py-1.5 rounded-md border text-sm disabled:opacity-50"}
      >
        {label}
      </button>
      {err && <div className="mt-1 text-[11px] text-red-600">{err}</div>}
    </div>
  );
}
