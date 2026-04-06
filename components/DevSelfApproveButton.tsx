"use client";

export default function DevSelfApproveButton({ locale }: { locale: string }) {
  return (
    <button
      type="button"
      className="inline-flex items-center rounded-lg border border-neutral-300 bg-white px-4 py-2 text-sm font-medium text-neutral-900 hover:bg-neutral-50"
      onClick={async () => {
        try {
          const res = await fetch("/api/teacher/dev-self-approve", { method: "POST" });
          if (!res.ok) {
            const data = await res.json().catch(() => ({}));
            throw new Error((data as any)?.error || `HTTP ${res.status}`);
          }
          window.location.href = `/${locale}/profile`;
        } catch (e: any) {
          window.alert(e?.message || "Не вдалося схвалити анкету");
        }
      }}
    >
      Схвалити анкету (dev)
    </button>
  );
}
