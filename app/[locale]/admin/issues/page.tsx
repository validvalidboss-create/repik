"use client";

import { useEffect, useMemo, useState } from "react";
import { usePathname } from "next/navigation";

type IssueItem = {
  id: string;
  type: string;
  status: string;
  message?: string | null;
  createdAt: string;
  booking: {
    id: string;
    studentId: string;
    status: string;
    startsAt: string;
    endsAt: string;
    startedAt?: string | null;
    endedAt?: string | null;
    student: { name?: string | null; email?: string | null };
    tutor: { userId: string; user: { name?: string | null; email?: string | null } };
  };
  reporter: { name?: string | null; email?: string | null };
};

function typeLabel(t: string) {
  switch (String(t || "").toUpperCase()) {
    case "TUTOR_NO_SHOW":
      return "Викладач не прийшов";
    case "STUDENT_COULD_NOT_JOIN":
      return "Не вдалося приєднатись";
    case "TECHNICAL_PROBLEM":
      return "Технічна проблема";
    case "QUALITY_NOT_AS_EXPECTED":
      return "Якість не відповідала очікуванням";
    default:
      return "Інше";
  }
}

function fmt(dt: string) {
  try {
    return new Date(dt).toLocaleString();
  } catch {
    return dt;
  }
}

function durationMin(startedAt?: string | null, endedAt?: string | null) {
  if (!startedAt || !endedAt) return null;
  const a = new Date(startedAt).getTime();
  const b = new Date(endedAt).getTime();
  if (!Number.isFinite(a) || !Number.isFinite(b) || b <= a) return null;
  return Math.max(1, Math.round((b - a) / 60000));
}

export default function AdminIssuesPage() {
  const [items, setItems] = useState<IssueItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [chatBusy, setChatBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const pathname = usePathname();
  const locale = pathname?.split("/")?.filter(Boolean)?.[0] || "uk";

  async function openSupportChat(targetUserId: string, issueId: string) {
    if (!targetUserId) {
      setError("Missing user id");
      return;
    }
    setChatBusy(issueId);
    setError(null);
    try {
      const res = await fetch("/api/admin/support-chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ targetUserId }),
      });
      const data = await res.json().catch(() => null);
      if (!res.ok || !data?.ok || !data?.bookingId) throw new Error(String(data?.error || `HTTP ${res.status}`));
      const href = `/${locale}/chat/${encodeURIComponent(String(data.bookingId))}`;
      window.location.href = href;
    } catch (e) {
      setError(e instanceof Error ? e.message : "Помилка відкриття чату");
    } finally {
      setChatBusy(null);
    }
  }

  async function load() {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/admin/issues?status=open", { cache: "no-store" });
      const data = await res.json().catch(() => null);
      if (!res.ok || !data?.ok) throw new Error(String(data?.error || `HTTP ${res.status}`));
      setItems(Array.isArray(data?.items) ? data.items : []);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Помилка завантаження");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, []);

  const sorted = useMemo(() => {
    return [...items].sort((a, b) => String(b.createdAt).localeCompare(String(a.createdAt)));
  }, [items]);

  async function resolve(issueId: string, decision: "student" | "tutor") {
    setBusyId(issueId);
    setError(null);
    try {
      const note = window.prompt(decision === "student" ? "Коментар менеджера (необов’язково)" : "Коментар менеджера (необов’язково)") || "";
      const res = await fetch("/api/admin/issues", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ issueId, decision, note }),
      });
      const data = await res.json().catch(() => null);
      if (!res.ok || !data?.ok) throw new Error(String(data?.error || `HTTP ${res.status}`));
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Помилка оновлення");
    } finally {
      setBusyId(null);
    }
  }

  return (
    <main className="container mx-auto px-4 py-8 space-y-6">
      <header className="flex items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold mb-1">Спори по уроках</h1>
          <p className="text-sm text-neutral-600">Відкриті звернення студентів після уроку. Прийми рішення та система оновить статус уроку.</p>
        </div>
        <div className="flex items-center gap-2">
          <a
            href={`/${locale}/admin/payouts`}
            className="inline-flex h-9 items-center rounded-xl border border-neutral-200 bg-white px-3 text-xs sm:text-sm font-semibold text-neutral-900 hover:bg-neutral-50"
          >
            Виплати
          </a>
          <a
            href={`/${locale}/admin/tutors`}
            className="inline-flex h-9 items-center rounded-xl border border-neutral-200 bg-white px-3 text-xs sm:text-sm font-semibold text-neutral-900 hover:bg-neutral-50"
          >
            Модерація анкет
          </a>
          <button
            type="button"
            onClick={load}
            className="inline-flex h-9 items-center rounded-xl border border-neutral-200 bg-white px-3 text-xs sm:text-sm font-semibold text-neutral-900 hover:bg-neutral-50"
          >
            Оновити
          </button>
        </div>
      </header>

      {error ? <div className="rounded border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{error}</div> : null}

      {loading ? (
        <p className="text-sm text-neutral-600">Завантаження…</p>
      ) : sorted.length === 0 ? (
        <div className="rounded-2xl border border-neutral-200 bg-white p-6">
          <div className="text-sm text-neutral-700">Немає відкритих спорів.</div>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {sorted.map((it) => {
            const studentName = it.booking?.student?.name || it.booking?.student?.email || "Студент";
            const tutorName = it.booking?.tutor?.user?.name || it.booking?.tutor?.user?.email || "Викладач";
            const busy = busyId === it.id;
            const factMin = durationMin(it.booking?.startedAt ?? null, it.booking?.endedAt ?? null);
            const chatBusyThis = chatBusy === it.id;
            return (
              <div key={it.id} className="rounded-2xl border border-neutral-200 bg-white p-5 space-y-3">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <div className="text-sm font-semibold text-neutral-900">{typeLabel(it.type)}</div>
                    <div className="mt-0.5 text-xs text-neutral-600">Створено: {fmt(it.createdAt)}</div>
                  </div>
                  <span className="inline-flex items-center rounded-full bg-amber-50 px-2.5 py-0.5 text-[11px] font-medium text-amber-800 border border-amber-200">
                    OPEN
                  </span>
                </div>

                <div className="text-xs text-neutral-600">
                  Урок: {fmt(it.booking.startsAt)} – {fmt(it.booking.endsAt)}
                </div>
                <div className="text-xs text-neutral-600">
                  Фактично: {it.booking.startedAt ? fmt(it.booking.startedAt) : "—"} – {it.booking.endedAt ? fmt(it.booking.endedAt) : "—"}
                  {typeof factMin === "number" ? <span className="text-neutral-500"> (≈ {factMin} хв)</span> : null}
                </div>
                <div className="text-xs text-neutral-600">Студент: {studentName}</div>
                <div className="text-xs text-neutral-600">Викладач: {tutorName}</div>
                <div className="text-xs text-neutral-600">Статус уроку: {it.booking.status}</div>

                {it.message ? (
                  <div className="rounded-xl border border-neutral-200 bg-neutral-50 p-3 text-sm text-neutral-800 whitespace-pre-wrap">
                    {it.message}
                  </div>
                ) : null}

                <div className="pt-2 flex flex-col sm:flex-row gap-2">
                  <button
                    type="button"
                    disabled={busy}
                    onClick={() => resolve(it.id, "student")}
                    className="inline-flex h-10 items-center justify-center rounded-xl bg-emerald-600 px-4 text-sm font-semibold text-white hover:bg-emerald-700 disabled:opacity-60"
                  >
                    Рішення: студент правий
                  </button>
                  <button
                    type="button"
                    disabled={busy}
                    onClick={() => resolve(it.id, "tutor")}
                    className="inline-flex h-10 items-center justify-center rounded-xl bg-neutral-900 px-4 text-sm font-semibold text-white hover:bg-neutral-800 disabled:opacity-60"
                  >
                    Рішення: викладач правий
                  </button>
                  <a
                    href={`/${locale}/lesson/${encodeURIComponent(it.booking.id)}`}
                    className="inline-flex h-10 items-center justify-center rounded-xl border border-neutral-200 bg-white px-4 text-sm font-semibold text-neutral-900 hover:bg-neutral-50"
                  >
                    Відкрити урок
                  </a>
                  <button
                    type="button"
                    disabled={chatBusyThis}
                    onClick={() => openSupportChat(String(it.booking.studentId || ""), it.id)}
                    className="inline-flex h-10 items-center justify-center rounded-xl border border-neutral-200 bg-white px-4 text-sm font-semibold text-neutral-900 hover:bg-neutral-50 disabled:opacity-60"
                  >
                    Написати учню
                  </button>
                  <button
                    type="button"
                    disabled={chatBusyThis}
                    onClick={() => openSupportChat(String(it.booking.tutor.userId || ""), it.id)}
                    className="inline-flex h-10 items-center justify-center rounded-xl border border-neutral-200 bg-white px-4 text-sm font-semibold text-neutral-900 hover:bg-neutral-50 disabled:opacity-60"
                  >
                    Написати викладачу
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
