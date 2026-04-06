"use client";

import { useState } from "react";

export default function AdminDeactivateTutorButton({
  tutorId,
  className,
}: {
  tutorId: string;
  className?: string;
}) {
  const [busy, setBusy] = useState(false);

  return (
    <button
      type="button"
      disabled={busy}
      onClick={async (e) => {
        e.preventDefault();
        e.stopPropagation();

        const reason = window.prompt(
          "Вкажіть причину (це побачить викладач). Після цього анкета буде знята з пошуку.",
        );
        if (!reason) return;

        setBusy(true);
        try {
          const res = await fetch("/api/admin/tutors", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ tutorId, action: "deactivate", reason }),
          });
          if (!res.ok) {
            const data = await res.json().catch(() => ({} as any));
            throw new Error(data.error || `HTTP ${res.status}`);
          }
          window.location.reload();
        } catch (err: any) {
          window.alert(err?.message || "Не вдалося зняти анкету з пошуку");
        } finally {
          setBusy(false);
        }
      }}
      className={
        className ||
        "absolute top-2 right-2 rounded-full bg-white/90 border px-2.5 py-1 text-[11px] font-medium text-red-700 hover:bg-red-50 disabled:opacity-60"
      }
      aria-label="delete"
      title="Видалити з пошуку"
    >
      {busy ? "..." : "Видалити"}
    </button>
  );
}
