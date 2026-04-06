"use client";

import { useState } from "react";

export default function ResetTutorOnboardingButton({
  locale,
  className,
  label = "Створити анкету заново",
}: {
  locale: string;
  className?: string;
  label?: string;
}) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string>("");

  async function onReset() {
    const ok = window.confirm(
      "Скинути анкету і створити заново? Це очистить поточні дані анкети.",
    );
    if (!ok) return;

    setBusy(true);
    setError("");
    try {
      const res = await fetch("/api/teacher/onboarding", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ resetOnboarding: true }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data?.error || `HTTP ${res.status}`);
      }

      window.location.href = `/${locale}/teacher/onboarding`;
    } catch (e: any) {
      setError(String(e?.message || e));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-2">
      <button
        type="button"
        onClick={onReset}
        disabled={busy}
        className={
          className ||
          "inline-flex items-center rounded-lg bg-black px-4 py-2 text-sm font-medium text-white hover:bg-neutral-800 disabled:opacity-60"
        }
      >
        {busy ? "Скидаю…" : label}
      </button>
      {error ? <div className="text-xs text-red-600">{error}</div> : null}
    </div>
  );
}
