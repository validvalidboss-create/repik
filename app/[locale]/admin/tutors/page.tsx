"use client";

import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import Link from "next/link";

type AdminTutor = {
  id: string;
  subjects: string[];
  headline: string | null;
  rateCents: number;
  currency: string;
  tracks: string[] | null;
  moderationNote?: string | null;
  user: { name: string | null; email: string | null };
};

export default function AdminTutorsPage() {
  const [items, setItems] = useState<AdminTutor[]>([]);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const pathname = usePathname();
  const locale = pathname?.split("/")?.filter(Boolean)?.[0] || "uk";

  async function load() {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/admin/tutors?status=pending");
      const data = await res.json();
      setItems(data.items || []);
    } catch (e: any) {
      setError(e?.message || "Помилка завантаження");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, []);

  async function changeStatus(tutorId: string, status: "active" | "rejected" | "needs_revision") {
    setBusyId(tutorId);
    setError(null);
    try {
      let reason: string | undefined;
      if (status === "rejected" || status === "needs_revision") {
        // Для MVP используем простий prompt
        const input = window.prompt(
          status === "rejected"
            ? "Вкажіть причину відхилення анкети (це побачить викладач)"
            : "Опишіть, що потрібно виправити в анкеті (це побачить викладач)",
        );
        if (!input) {
          setBusyId(null);
          return;
        }
        reason = input;
      }
      const res = await fetch("/api/admin/tutors", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ tutorId, status, reason }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || `HTTP ${res.status}`);
      }
      await load();
    } catch (e: any) {
      setError(e?.message || "Помилка оновлення статусу");
    } finally {
      setBusyId(null);
    }
  }

  return (
    <main className="container mx-auto px-4 py-8 space-y-6">
      <header className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold mb-1">Модерація анкет викладачів</h1>
          <p className="text-sm text-neutral-600">
            Тут відображаються анкети зі статусом «на модерації». Після схвалення вони стають
            видимими у пошуку.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <a
            href={`/${locale}/admin/payouts`}
            className="text-sm px-3 py-1.5 rounded border border-neutral-300 hover:bg-neutral-50"
          >
            Виплати
          </a>
          <a
            href={`/${locale}/admin/issues`}
            className="text-sm px-3 py-1.5 rounded border border-neutral-300 hover:bg-neutral-50"
          >
            Спори
          </a>
          <button
            type="button"
            onClick={load}
            className="text-sm px-3 py-1.5 rounded border border-neutral-300 hover:bg-neutral-50"
          >
            Оновити
          </button>
        </div>
      </header>

      {error && (
        <div className="rounded border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
          {error}
        </div>
      )}

      {loading ? (
        <p className="text-sm text-neutral-600">Завантаження…</p>
      ) : items.length === 0 ? (
        <p className="text-sm text-neutral-600">Немає анкет, що очікують модерації.</p>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {items.map((tutor) => {
            const tracks = Array.isArray(tutor.tracks) ? (tutor.tracks as string[]) : [];
            const status = tracks.find((t) => t.startsWith("status:"))?.replace("status:", "") || "pending";
            const price = tutor.rateCents > 0 ? `${Math.round(tutor.rateCents / 100)} ${tutor.currency}` : "—";

            return (
              <div key={tutor.id} className="border rounded-lg p-4 space-y-2 bg-white">
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <div className="font-medium">
                      {tutor.user.name || tutor.user.email || "Без імені"}
                    </div>
                    <div className="text-xs text-neutral-500">{tutor.user.email}</div>
                  </div>
                  <span className="inline-flex items-center rounded-full bg-neutral-100 px-2.5 py-0.5 text-[11px] font-medium text-neutral-700 border border-dashed border-neutral-300">
                    {status === "pending" && "На модерації"}
                    {status === "active" && "Активна"}
                    {status === "rejected" && "Відхилена"}
                    {status === "needs_revision" && "Потрібні правки"}
                  </span>
                </div>

                {tutor.headline && (
                  <div className="text-sm text-neutral-800 line-clamp-2">{tutor.headline}</div>
                )}

                {tutor.subjects?.length > 0 && (
                  <div className="text-xs text-neutral-600">
                    Предмети: {tutor.subjects.join(", ")}
                  </div>
                )}

                <div className="text-xs text-neutral-600">Ставка: {price}</div>

                {tutor.moderationNote && (
                  <div className="mt-1 text-xs text-neutral-700 bg-neutral-50 border border-dashed border-neutral-200 rounded p-2">
                    <div className="font-medium mb-0.5">Коментар модератора:</div>
                    <div className="whitespace-pre-wrap">{tutor.moderationNote}</div>
                  </div>
                )}

                <div className="pt-2 flex gap-2">
                  <Link
                    href={`/${locale}/tutors/${encodeURIComponent(tutor.id)}`}
                    className="px-3 py-1.5 rounded-md border border-neutral-300 bg-white text-xs font-medium text-neutral-800 hover:bg-neutral-50"
                  >
                    Переглянути анкету
                  </Link>
                  <button
                    type="button"
                    disabled={busyId === tutor.id}
                    onClick={() => changeStatus(tutor.id, "active")}
                    className="px-3 py-1.5 rounded-md bg-emerald-600 text-xs font-medium text-white hover:bg-emerald-700 disabled:opacity-60"
                  >
                    Схвалити
                  </button>
                  <button
                    type="button"
                    disabled={busyId === tutor.id}
                    onClick={() => changeStatus(tutor.id, "rejected")}
                    className="px-3 py-1.5 rounded-md bg-red-600 text-xs font-medium text-white hover:bg-red-700 disabled:opacity-60"
                  >
                    Відхилити
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </main>
  );
}
