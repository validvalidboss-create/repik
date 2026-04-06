"use client";

import { useEffect, useMemo, useState } from "react";
import { usePathname } from "next/navigation";

type AdminPayoutItem = {
  id: string;
  createdAt: string;
  updatedAt?: string;
  status: string;
  amountCents: number;
  currency: string;
  externalId?: string | null;
  note?: string | null;
  tutor: {
    id: string;
    name: string;
    email: string;
    currency: string;
    payoutReceiverName?: string | null;
    payoutIban?: string | null;
    payoutBankName?: string | null;
    payoutCardLast4?: string | null;
  };
  balance: {
    availableCents: number;
    holdCents: number;
    payoutPendingCents: number;
    paidCents: number;
    earnedSettledCents: number;
    grossSettledCents?: number;
    commissionSettledCents?: number;
    grossHoldCents?: number;
    commissionHoldCents?: number;
  };
};

function fmtMoney(cents: number, currency: string) {
  return `${(Number(cents || 0) / 100).toFixed(0)} ${currency || "UAH"}`;
}

function fmt(dt: string) {
  try {
    return new Date(dt).toLocaleString();
  } catch {
    return dt;
  }
}

export default function AdminPayoutsPage() {
  const [items, setItems] = useState<AdminPayoutItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [status, setStatus] = useState<string>("pending");
  const [q, setQ] = useState<string>("");
  const [busyId, setBusyId] = useState<string | null>(null);

  const pathname = usePathname();
  const locale = pathname?.split("/")?.filter(Boolean)?.[0] || "uk";

  async function load(nextStatus?: string, nextQ?: string) {
    setLoading(true);
    setError(null);
    try {
      const s = (nextStatus ?? status) || "pending";
      const qq = (nextQ ?? q) || "";
      const qs = new URLSearchParams();
      if (s) qs.set("status", s);
      if (qq.trim()) qs.set("q", qq.trim());
      const res = await fetch(`/api/admin/payouts?${qs.toString()}`, { cache: "no-store" });
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
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const sorted = useMemo(() => {
    return [...items].sort((a, b) => String(b.createdAt).localeCompare(String(a.createdAt)));
  }, [items]);

  async function setPayoutStatus(payoutId: string, next: "PAID" | "FAILED") {
    setBusyId(payoutId);
    setError(null);
    try {
      const externalId = window.prompt("externalId/номер транзакції (необов'язково)") || "";
      const res = await fetch("/api/admin/payouts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ payoutId, status: next, externalId: externalId.trim() || undefined }),
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

  async function editPayoutDetails(tutorId: string) {
    setBusyId(tutorId);
    setError(null);
    try {
      const receiverName = window.prompt("Ім'я отримувача (необов'язково)") || "";
      const iban = window.prompt("IBAN (необов'язково)") || "";
      const bankName = window.prompt("Банк (необов'язково)") || "";
      const cardLast4 = window.prompt("Останні 4 цифри карти (необов'язково)") || "";

      const res = await fetch("/api/admin/payout-details", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ tutorId, receiverName, iban, bankName, cardLast4 }),
      });
      const data = await res.json().catch(() => null);
      if (!res.ok || !data?.ok) throw new Error(String(data?.error || `HTTP ${res.status}`));
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Помилка збереження реквізитів");
    } finally {
      setBusyId(null);
    }
  }

  return (
    <main className="container mx-auto px-4 py-8 space-y-6">
      <header className="flex items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold mb-1">Виплати</h1>
          <p className="text-sm text-neutral-600">Заявки на виплату викладачам + їхній баланс та реквізити.</p>
        </div>
        <div className="flex items-center gap-2">
          <a
            href={`/${locale}/admin/issues`}
            className="inline-flex h-9 items-center rounded-xl border border-neutral-200 bg-white px-3 text-xs sm:text-sm font-semibold text-neutral-900 hover:bg-neutral-50"
          >
            Спори
          </a>
          <a
            href={`/${locale}/admin/tutors`}
            className="inline-flex h-9 items-center rounded-xl border border-neutral-200 bg-white px-3 text-xs sm:text-sm font-semibold text-neutral-900 hover:bg-neutral-50"
          >
            Анкети
          </a>
          <button
            type="button"
            onClick={() => load()}
            className="inline-flex h-9 items-center rounded-xl border border-neutral-200 bg-white px-3 text-xs sm:text-sm font-semibold text-neutral-900 hover:bg-neutral-50"
          >
            Оновити
          </button>
        </div>
      </header>

      {error ? <div className="rounded border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{error}</div> : null}

      <div className="flex flex-col sm:flex-row gap-2 sm:items-center">
        <select
          value={status}
          onChange={(e) => {
            const v = e.target.value;
            setStatus(v);
            load(v, q);
          }}
          className="h-10 rounded-xl border border-neutral-200 bg-white px-3 text-sm"
        >
          <option value="pending">PENDING</option>
          <option value="paid">PAID</option>
          <option value="failed">FAILED</option>
          <option value="all">ALL</option>
        </select>
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Пошук (email/ім'я/tutorId)"
          className="h-10 flex-1 rounded-xl border border-neutral-200 bg-white px-3 text-sm"
        />
        <button
          type="button"
          onClick={() => load(status, q)}
          className="inline-flex h-10 items-center justify-center rounded-xl bg-neutral-900 px-4 text-sm font-semibold text-white hover:bg-neutral-800"
        >
          Знайти
        </button>
      </div>

      {loading ? (
        <p className="text-sm text-neutral-600">Завантаження…</p>
      ) : sorted.length === 0 ? (
        <div className="rounded-2xl border border-neutral-200 bg-white p-6">
          <div className="text-sm text-neutral-700">Немає заявок.</div>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {sorted.map((it) => {
            const busy = busyId === it.id || busyId === it.tutor.id;
            return (
              <div key={it.id} className="rounded-2xl border border-neutral-200 bg-white p-5 space-y-3">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="text-sm font-semibold text-neutral-900 truncate">
                      {fmtMoney(it.amountCents, it.currency)}
                      <span className="mx-2 text-neutral-300">·</span>
                      {it.status}
                    </div>
                    <div className="mt-0.5 text-xs text-neutral-600 truncate">
                      {it.tutor.name || it.tutor.email || it.tutor.id}
                    </div>
                    <div className="mt-0.5 text-xs text-neutral-600">Створено: {fmt(it.createdAt)}</div>
                    {it.externalId ? <div className="mt-0.5 text-xs text-neutral-600">externalId: {it.externalId}</div> : null}
                  </div>
                  <span className="inline-flex items-center rounded-full bg-neutral-100 px-2.5 py-0.5 text-[11px] font-medium text-neutral-700 border border-dashed border-neutral-300">
                    {it.status}
                  </span>
                </div>

                <div className="grid grid-cols-2 gap-2">
                  <div className="rounded-xl border border-neutral-200 bg-neutral-50 p-3">
                    <div className="text-[11px] text-neutral-600">Доступно</div>
                    <div className="text-sm font-semibold text-neutral-900">{fmtMoney(it.balance.availableCents, it.tutor.currency)}</div>
                    {typeof it.balance.grossSettledCents === "number" && typeof it.balance.commissionSettledCents === "number" ? (
                      <div className="mt-1 text-[11px] text-neutral-600">
                        Уроки: {fmtMoney(it.balance.grossSettledCents, it.tutor.currency)}
                        <span className="mx-1 text-neutral-300">·</span>
                        Комісія: {fmtMoney(it.balance.commissionSettledCents, it.tutor.currency)}
                      </div>
                    ) : null}
                  </div>
                  <div className="rounded-xl border border-neutral-200 bg-neutral-50 p-3">
                    <div className="text-[11px] text-neutral-600">В холді</div>
                    <div className="text-sm font-semibold text-neutral-900">{fmtMoney(it.balance.holdCents, it.tutor.currency)}</div>
                    {typeof it.balance.grossHoldCents === "number" && typeof it.balance.commissionHoldCents === "number" ? (
                      <div className="mt-1 text-[11px] text-neutral-600">
                        Уроки: {fmtMoney(it.balance.grossHoldCents, it.tutor.currency)}
                        <span className="mx-1 text-neutral-300">·</span>
                        Комісія: {fmtMoney(it.balance.commissionHoldCents, it.tutor.currency)}
                      </div>
                    ) : null}
                  </div>
                  <div className="rounded-xl border border-neutral-200 bg-neutral-50 p-3">
                    <div className="text-[11px] text-neutral-600">На виплаті</div>
                    <div className="text-sm font-semibold text-neutral-900">{fmtMoney(it.balance.payoutPendingCents, it.tutor.currency)}</div>
                  </div>
                  <div className="rounded-xl border border-neutral-200 bg-neutral-50 p-3">
                    <div className="text-[11px] text-neutral-600">Виплачено</div>
                    <div className="text-sm font-semibold text-neutral-900">{fmtMoney(it.balance.paidCents, it.tutor.currency)}</div>
                  </div>
                </div>

                <div className="rounded-xl border border-neutral-200 bg-white p-3">
                  <div className="text-xs font-semibold text-neutral-900">Реквізити</div>
                  <div className="mt-1 text-xs text-neutral-700">Отримувач: {it.tutor.payoutReceiverName || "—"}</div>
                  <div className="mt-0.5 text-xs text-neutral-700">IBAN: {it.tutor.payoutIban || "—"}</div>
                  <div className="mt-0.5 text-xs text-neutral-700">Банк: {it.tutor.payoutBankName || "—"}</div>
                  <div className="mt-0.5 text-xs text-neutral-700">Карта: {it.tutor.payoutCardLast4 ? `**** ${it.tutor.payoutCardLast4}` : "—"}</div>
                </div>

                <div className="pt-2 flex flex-col sm:flex-row gap-2">
                  <button
                    type="button"
                    disabled={busy || it.status !== "PENDING"}
                    onClick={() => setPayoutStatus(it.id, "PAID")}
                    className="inline-flex h-10 items-center justify-center rounded-xl bg-emerald-600 px-4 text-sm font-semibold text-white hover:bg-emerald-700 disabled:opacity-60"
                  >
                    Mark PAID
                  </button>
                  <button
                    type="button"
                    disabled={busy || it.status !== "PENDING"}
                    onClick={() => setPayoutStatus(it.id, "FAILED")}
                    className="inline-flex h-10 items-center justify-center rounded-xl bg-red-600 px-4 text-sm font-semibold text-white hover:bg-red-700 disabled:opacity-60"
                  >
                    Mark FAILED
                  </button>
                  <button
                    type="button"
                    disabled={busy}
                    onClick={() => editPayoutDetails(it.tutor.id)}
                    className="inline-flex h-10 items-center justify-center rounded-xl border border-neutral-200 bg-white px-4 text-sm font-semibold text-neutral-900 hover:bg-neutral-50 disabled:opacity-60"
                  >
                    Редагувати реквізити
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
