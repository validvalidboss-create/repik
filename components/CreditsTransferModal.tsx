"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";

export default function CreditsTransferModal({
  locale,
  fromTutorId,
  toTutorId,
  fromTutorName,
  toTutorName,
  fromCredits,
  transferCredits,
  onCloseHref,
}: {
  locale: string;
  fromTutorId: string;
  toTutorId: string;
  fromTutorName: string;
  toTutorName: string;
  fromCredits: number;
  transferCredits: number;
  onCloseHref: string;
}) {
  const [step, setStep] = useState<"confirm" | "success">("confirm");
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState<string>("");
  const maxCredits = Math.max(0, Math.floor(Number(fromCredits) || 0));
  const [creditsToTransfer, setCreditsToTransfer] = useState(() => {
    const initial = Math.max(1, Math.floor(Number(transferCredits) || 1));
    return Math.min(initial, maxCredits);
  });

  const transferKey = useMemo(() => {
    const rnd = typeof crypto !== "undefined" && "randomUUID" in crypto ? (crypto as any).randomUUID() : String(Date.now());
    return `transfer:${fromTutorId}:${toTutorId}:${rnd}`;
  }, [fromTutorId, toTutorId]);

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") {
        window.location.href = onCloseHref;
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onCloseHref]);

  async function confirm() {
    if (loading) return;
    setLoading(true);
    setErr("");
    try {
      const res = await fetch("/api/credits/transfer", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          fromTutorId,
          toTutorId,
          credits: creditsToTransfer,
          transferKey,
        }),
      });
      const json = await res.json().catch(() => null);
      if (!res.ok || !json?.ok) throw new Error(String(json?.error || "Failed"));
      setStep("success");
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Failed");
    } finally {
      setLoading(false);
    }
  }

  const remaining = Math.max(0, maxCredits - Math.max(0, Math.floor(Number(creditsToTransfer) || 0)));

  return (
    <div
      className="fixed inset-0 z-[10000] flex items-center justify-center bg-black/40 px-4"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) window.location.href = onCloseHref;
      }}
    >
      <div className="w-full max-w-md rounded-3xl bg-white shadow-2xl border border-neutral-200 p-5">
        <div className="flex items-center justify-between gap-3">
          <button
            type="button"
            className="inline-flex h-10 w-10 items-center justify-center rounded-full hover:bg-neutral-100 text-neutral-800"
            onClick={() => (window.location.href = onCloseHref)}
            aria-label="Back"
          >
            ←
          </button>
          <div className="text-base font-semibold text-neutral-900">
            {step === "confirm" ? "Перевірте деталі переказу" : "Переказ здійснено"}
          </div>
          <div className="h-10 w-10" />
        </div>

        {step === "confirm" ? (
          <div className="mt-4">
            <div className="rounded-2xl border border-neutral-200 bg-neutral-50 p-4">
              <div className="flex items-center justify-between text-sm">
                <div className="text-neutral-600">Баланс з {fromTutorName}</div>
                <div className="font-semibold text-neutral-900">{maxCredits} уроків</div>
              </div>
              <div className="mt-2 flex items-center justify-between text-sm">
                <div className="text-neutral-600">Переказ до {toTutorName}</div>
                <div className="font-semibold text-neutral-900">{Math.max(0, Math.floor(creditsToTransfer || 0))} уроків</div>
              </div>
              <div className="mt-2 flex items-center justify-between text-sm">
                <div className="text-neutral-600">Залишок з {fromTutorName}</div>
                <div className="font-semibold text-neutral-900">{remaining} уроків</div>
              </div>
            </div>

            <div className="mt-4">
              <div className="text-sm font-semibold text-neutral-900">Скільки уроків переказати?</div>
              <div className="mt-2 grid grid-cols-3 gap-2">
                <button
                  type="button"
                  onClick={() => setCreditsToTransfer(Math.min(1, maxCredits))}
                  disabled={loading || maxCredits < 1}
                  className={
                    creditsToTransfer === 1
                      ? "h-10 rounded-xl bg-black text-white text-sm font-semibold"
                      : "h-10 rounded-xl border border-neutral-200 bg-white text-neutral-900 text-sm font-semibold hover:bg-neutral-50"
                  }
                >
                  1
                </button>
                <button
                  type="button"
                  onClick={() => setCreditsToTransfer(Math.min(2, maxCredits))}
                  disabled={loading || maxCredits < 2}
                  className={
                    creditsToTransfer === 2
                      ? "h-10 rounded-xl bg-black text-white text-sm font-semibold"
                      : "h-10 rounded-xl border border-neutral-200 bg-white text-neutral-900 text-sm font-semibold hover:bg-neutral-50"
                  }
                >
                  2
                </button>
                <button
                  type="button"
                  onClick={() => setCreditsToTransfer(maxCredits)}
                  disabled={loading || maxCredits < 1}
                  className={
                    creditsToTransfer === maxCredits
                      ? "h-10 rounded-xl bg-black text-white text-sm font-semibold"
                      : "h-10 rounded-xl border border-neutral-200 bg-white text-neutral-900 text-sm font-semibold hover:bg-neutral-50"
                  }
                >
                  Всі
                </button>
              </div>
              <div className="mt-2 text-xs text-neutral-500">Можна переказувати частинами — баланс з {fromTutorName} залишиться доступним.</div>
            </div>

            <div className="mt-4">
              <div className="text-sm font-semibold text-neutral-900">Що далі?</div>
              <div className="mt-2 text-sm text-neutral-700 space-y-2">
                <div>1) Уроки будуть додані до балансу з {toTutorName}.</div>
                <div>2) Ваші уроки з {fromTutorName} залишаться доступними ({remaining} уроків).</div>
                <div>3) Ви зможете одразу запланувати уроки з новим викладачем.</div>
              </div>
            </div>

            {err ? <div className="mt-3 text-sm text-red-600">{err}</div> : null}

            <button
              type="button"
              onClick={confirm}
              disabled={loading || creditsToTransfer <= 0}
              className={
                !loading
                  ? "mt-5 w-full h-12 rounded-2xl bg-pink-500 px-5 text-sm font-semibold text-white hover:bg-pink-600"
                  : "mt-5 w-full h-12 rounded-2xl bg-pink-200 px-5 text-sm font-semibold text-white cursor-not-allowed"
              }
            >
              {loading ? "Переказуємо…" : "Підтвердити переказ"}
            </button>

            <div className="mt-3">
              <Link
                href={onCloseHref}
                className="inline-flex w-full h-12 items-center justify-center rounded-2xl border border-neutral-200 bg-white px-5 text-sm font-semibold text-neutral-900 hover:bg-neutral-50"
              >
                Скасувати
              </Link>
            </div>
          </div>
        ) : (
          <div className="mt-5">
            <div className="rounded-2xl bg-pink-50 border border-pink-200 p-4">
              <div className="text-sm font-semibold text-neutral-900">Зробимо підсумки:</div>
              <div className="mt-2 text-sm text-neutral-800 space-y-2">
                <div>• {Math.max(0, Math.floor(creditsToTransfer || 0))} уроків додано до балансу з {toTutorName}.</div>
                <div>• У вас також є {remaining} уроків з {fromTutorName}.</div>
              </div>
            </div>

            <Link
              href={`/${locale}/schedule/${encodeURIComponent(toTutorId)}`}
              className="mt-5 inline-flex w-full h-12 items-center justify-center rounded-2xl bg-black px-5 text-sm font-semibold text-white hover:bg-neutral-800"
            >
              Запланувати уроки
            </Link>

            <Link
              href={onCloseHref}
              className="mt-3 inline-flex w-full h-12 items-center justify-center rounded-2xl border border-neutral-200 bg-white px-5 text-sm font-semibold text-neutral-900 hover:bg-neutral-50"
            >
              Готово
            </Link>
          </div>
        )}
      </div>
    </div>
  );
}
