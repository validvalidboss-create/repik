"use client";

import { useState } from "react";

export default function AdminResetTutorButton({ tutorId, className }: { tutorId: string; className?: string }) {
  const [busy, setBusy] = useState(false);

  return (
    <button
      type="button"
      disabled={busy}
      onClick={async (e) => {
        e.preventDefault();
        e.stopPropagation();

        const ok = window.confirm(
          "Скинути/видалити анкету викладача? Будуть очищені дані анкети, коментар модератора та розклад (availability).",
        );
        if (!ok) return;

        setBusy(true);
        try {
          const res = await fetch("/api/admin/tutors", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ tutorId, action: "reset" }),
          });
          if (!res.ok) {
            const data = await res.json().catch(() => ({} as any));
            throw new Error(data.error || `HTTP ${res.status}`);
          }
          window.location.reload();
        } catch (err: any) {
          window.alert(err?.message || "Не вдалося видалити анкету");
        } finally {
          setBusy(false);
        }
      }}
      className={
        className ||
        "px-2.5 py-1 rounded-md border border-red-300 bg-white text-[11px] font-medium text-red-700 hover:bg-red-50 disabled:opacity-60"
      }
    >
      {busy ? "..." : "Видалити"}
    </button>
  );
}
