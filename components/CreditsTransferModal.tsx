"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import ContinueLessonsButton from "@/components/ContinueLessonsButton";

const COMMISSION_RATE = 0.01;
const MIN_COMMISSION_CENTS = 1000;

export default function CreditsTransferModal({
  locale,
  fromTutorId,
  toTutorId,
  fromTutorName,
  toTutorName,
  fromCredits,
  toCredits,
  fromRateCents,
  toRateCents,
  transferCredits,
  onCloseHref,
}: {
  locale: string;
  fromTutorId: string;
  toTutorId: string;
  fromTutorName: string;
  toTutorName: string;
  fromCredits: number;
  toCredits: number;
  fromRateCents: number;
  toRateCents: number;
  transferCredits: number;
  onCloseHref: string;
}) {
  const [step, setStep] = useState<"confirm" | "success">("confirm");
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState<string>("");
  const [payOpen, setPayOpen] = useState(false);
  const [payInitialLessons, setPayInitialLessons] = useState<number | null>(null);
  const [infoOpen, setInfoOpen] = useState(false);
  const maxCredits = Math.max(0, Math.floor(Number(fromCredits) || 0));
  const targetHasActiveSub = Math.max(0, Math.floor(Number(toCredits) || 0)) > 0;

  const minTransferCredits = 1;
  const maxTransferCredits = maxCredits;
  const [creditsToTransfer, setCreditsToTransfer] = useState(() => {
    const initial = Math.max(minTransferCredits, Math.floor(Number(transferCredits) || minTransferCredits));
    return Math.min(initial, Math.max(minTransferCredits, maxTransferCredits));
  });

  const initials = (name: string) => {
    const s = String(name || "").trim();
    if (!s) return "T";
    const parts = s.split(/\s+/).filter(Boolean);
    const a = String(parts[0]?.[0] || "T").toUpperCase();
    const b = String(parts.length > 1 ? parts[1]?.[0] || "" : "").toUpperCase();
    return (a + b).slice(0, 2);
  };

  useEffect(() => {
    // Keep value in bounds if maxCredits changes.
    setCreditsToTransfer((v) => {
      const cur = Math.max(minTransferCredits, Math.floor(Number(v) || minTransferCredits));
      return Math.min(cur, Math.max(minTransferCredits, maxTransferCredits));
    });
  }, [maxCredits, minTransferCredits, maxTransferCredits]);

  const transferKey = useMemo(() => {
    const rnd = typeof crypto !== "undefined" && "randomUUID" in crypto ? (crypto as any).randomUUID() : String(Date.now());
    return `transfer:${fromTutorId}:${toTutorId}:${rnd}`;
  }, [fromTutorId, toTutorId]);

  const money = (cents: number) => {
    const v = Number(cents || 0) || 0;
    const uah = Math.max(0, v / 100);
    return new Intl.NumberFormat("uk-UA", { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(uah);
  };

  const feeForValueCents = (valueCents: number) => {
    const v = Math.max(0, Math.floor(Number(valueCents) || 0));
    if (!v) return 0;
    return Math.max(MIN_COMMISSION_CENTS, Math.round(v * COMMISSION_RATE));
  };

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
      const desiredCredits = Math.max(1, Math.floor(Number(creditsToTransfer) || 1));
      const fromRate = Math.max(0, Math.floor(Number(fromRateCents) || 0));
      const toRate = Math.max(0, Math.floor(Number(toRateCents) || 0));

      if (!fromRate || !toRate) throw new Error("Не вдалося визначити ціну уроку");

      // If target tutor has no active subscription, the transfer should act as a discount
      // for buying a new package (min 4 lessons via slider). In this case we convert the
      // transferred value into wallet credit and open the purchase flow.
      if (!targetHasActiveSub) {
        setPayInitialLessons(Math.max(4, desiredCredits));
        setPayOpen(true);
        setLoading(false);
        return;
      }

      // Try to transfer value (money-mode) as much as possible within available source credits.
      // Remaining credits (if any) are offered as a separate card top-up.
      const maxTransferableValueCents = maxCredits * fromRate;
      const neededValueCents = desiredCredits * toRate;

      let valueCents = Math.min(maxTransferableValueCents, neededValueCents);
      valueCents = Math.floor(valueCents / toRate) * toRate;
      if (valueCents < toRate) {
        const feeCents = feeForValueCents(Math.max(0, desiredCredits * fromRate));
        const baseBody = {
          mode: "to_wallet",
          fromTutorId,
          toTutorId,
          credits: desiredCredits,
          feeCents,
          transferKey,
        };

        const doReq = async (confirmCancelUpcoming: boolean) => {
          const res = await fetch("/api/credits/transfer", {
            method: "POST",
            headers: { "content-type": "application/json" },
            body: JSON.stringify({ ...baseBody, confirmCancelUpcoming }),
          });
          const json = await res.json().catch(() => null);
          return { res, json };
        };

        let { res, json } = await doReq(false);
        if (res.status === 409 && json?.requiresConfirm) {
          const msg = String(json?.confirmMessage || "Потрібне підтвердження");
          const ok = typeof window !== "undefined" ? window.confirm(msg) : false;
          if (!ok) throw new Error(msg);
          ({ res, json } = await doReq(true));
        }

        if (!res.ok || !json?.ok) throw new Error(String(json?.error || json?.confirmMessage || "Failed"));

        setPayInitialLessons(desiredCredits);
        setPayOpen(true);
        setLoading(false);
        return;
      }

      // Apply minimal commission (2%, but at least 17 UAH) and ensure we don't exceed maxCredits after adding fee.
      while (true) {
        const feeCents = feeForValueCents(valueCents);
        const totalDebitValueCents = valueCents + Math.max(0, feeCents);
        const debitCredits = Math.ceil(totalDebitValueCents / fromRate);
        if (debitCredits <= maxCredits) break;
        valueCents -= toRate;
        if (valueCents < toRate) throw new Error("Недостатньо балансу для переказу");
      }

      const feeCents = feeForValueCents(valueCents);
      const toAddCredits = Math.floor(valueCents / toRate);
      const remainingCredits = Math.max(0, desiredCredits - Math.max(0, toAddCredits));

      const res = await fetch("/api/credits/transfer", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          mode: "money",
          fromTutorId,
          toTutorId,
          valueCents,
          feeCents,
          transferKey,
        }),
      });
      let json = await res.json().catch(() => null);
      if (res.status === 409 && json?.requiresConfirm) {
        const msg = String(json?.confirmMessage || "Потрібне підтвердження");
        const ok = typeof window !== "undefined" ? window.confirm(msg) : false;
        if (!ok) throw new Error(msg);
        const res2 = await fetch("/api/credits/transfer", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({
            mode: "money",
            fromTutorId,
            toTutorId,
            valueCents,
            feeCents,
            transferKey,
            confirmCancelUpcoming: true,
          }),
        });
        json = await res2.json().catch(() => null);
        if (!res2.ok || !json?.ok) throw new Error(String(json?.error || json?.confirmMessage || "Failed"));
      } else {
        if (!res.ok || !json?.ok) throw new Error(String(json?.error || json?.confirmMessage || "Failed"));
      }

      if (remainingCredits > 0) {
        setPayInitialLessons(remainingCredits);
        setPayOpen(true);
        setLoading(false);
        return;
      }

      setStep("success");
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Failed");
    } finally {
      setLoading(false);
    }
  }

  const remaining = Math.max(0, maxCredits - Math.max(0, Math.floor(Number(creditsToTransfer) || 0)));
  const perFrom = Math.max(0, Math.floor(Number(fromRateCents) || 0));
  const perTo = Math.max(0, Math.floor(Number(toRateCents) || 0));
  const creditsN = Math.max(0, Math.floor(Number(creditsToTransfer) || 0));
  const preview = (() => {
    if (!creditsN || !perFrom || !perTo) {
      return {
        mode: targetHasActiveSub ? ("money" as const) : ("to_wallet" as const),
        valueCents: 0,
        feeCents: 0,
        fromDebitCredits: 0,
        toAddCredits: 0,
        remainingToCredits: 0,
        toPayCents: 0,
        fromRemainingCredits: maxCredits,
      };
    }

    if (!targetHasActiveSub) {
      const valueCents = Math.max(0, creditsN * perFrom);
      const feeCents = feeForValueCents(valueCents);
      const fromDebitCredits = Math.min(maxCredits, creditsN);
      const fromRemainingCredits = Math.max(0, maxCredits - fromDebitCredits);
      return {
        mode: "to_wallet" as const,
        valueCents,
        feeCents,
        fromDebitCredits,
        toAddCredits: 0,
        remainingToCredits: 0,
        toPayCents: 0,
        fromRemainingCredits,
      };
    }

    const maxTransferableValueCents = maxCredits * perFrom;
    const neededValueCents = creditsN * perTo;
    let valueCents = Math.min(maxTransferableValueCents, neededValueCents);
    valueCents = Math.floor(valueCents / perTo) * perTo;
    if (valueCents < perTo) {
      // Would fallback to to_wallet in confirm(); show 0 to avoid misleading preview.
      return {
        mode: "to_wallet" as const,
        valueCents: Math.max(0, creditsN * perFrom),
        feeCents: feeForValueCents(Math.max(0, creditsN * perFrom)),
        fromDebitCredits: Math.min(maxCredits, creditsN),
        toAddCredits: 0,
        remainingToCredits: creditsN,
        toPayCents: creditsN * perTo,
        fromRemainingCredits: Math.max(0, maxCredits - Math.min(maxCredits, creditsN)),
      };
    }

    while (true) {
      const feeCents = feeForValueCents(valueCents);
      const totalDebitValueCents = valueCents + feeCents;
      const fromDebitCredits = Math.ceil(totalDebitValueCents / perFrom);
      if (fromDebitCredits <= maxCredits) break;
      valueCents -= perTo;
      if (valueCents < perTo) break;
    }

    const feeCents = feeForValueCents(valueCents);
    const toAddCredits = Math.floor(valueCents / perTo);
    const remainingToCredits = Math.max(0, creditsN - toAddCredits);
    const toPayCents = remainingToCredits * perTo;
    const fromDebitCredits = Math.ceil((valueCents + feeCents) / perFrom);
    const fromRemainingCredits = Math.max(0, maxCredits - Math.max(0, fromDebitCredits));

    return {
      mode: "money" as const,
      valueCents,
      feeCents,
      fromDebitCredits,
      toAddCredits,
      remainingToCredits,
      toPayCents,
      fromRemainingCredits,
    };
  })();

  return (
    <>
      {payOpen && payInitialLessons ? (
        <ContinueLessonsButton
          locale={String(locale)}
          tutorId={String(toTutorId)}
          tutorName={String(toTutorName)}
          pricePerLessonUAH={Math.max(0, Math.round(Math.max(0, Number(toRateCents) || 0) / 100))}
          pendingWalletCreditCents={!targetHasActiveSub ? Math.max(0, preview.valueCents - preview.feeCents) : 0}
          transfer={!targetHasActiveSub ? { fromTutorId: String(fromTutorId), transferCredits: Math.max(1, Math.floor(Number(creditsToTransfer) || 1)), transferKey } : undefined}
          variant="primary"
          buttonText="Оплатити"
          startOpen
          hideTrigger
          initialLessons={Number(payInitialLessons)}
          openMode="topup"
          onSuccess={() => {
            try {
              window.dispatchEvent(new Event("lesson-balance-changed"));
            } catch {
              // ignore
            }
            setPayOpen(false);
            setStep("success");
          }}
          onClose={() => {
            setPayOpen(false);
            window.location.href = `/${String(locale)}/tutors/${encodeURIComponent(String(toTutorId))}?buy=1`;
          }}
        />
      ) : null}

      {!payOpen ? (
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
                onClick={() => {
                  try {
                    if (typeof window !== "undefined" && window.history.length > 1) {
                      window.history.back();
                      return;
                    }
                  } catch {
                    // ignore
                  }
                  window.location.href = onCloseHref;
                }}
                aria-label="Back"
              >
                ←
              </button>
              <div className="text-base font-semibold text-neutral-900">
                {step === "confirm" ? "Перевірте деталі переказу" : "Переказ здійснено"}
              </div>
              <div className="relative">
                <button
                  type="button"
                  className="h-10 w-10 rounded-full border border-neutral-200 text-neutral-700 flex items-center justify-center text-xs font-semibold hover:bg-neutral-50"
                  aria-label="Info"
                  onMouseEnter={() => setInfoOpen(true)}
                  onMouseLeave={() => setInfoOpen(false)}
                  onFocus={() => setInfoOpen(true)}
                  onBlur={() => setInfoOpen(false)}
                >
                  i
                </button>
                {infoOpen ? (
                  <div className="absolute right-0 top-12 z-10 w-72 rounded-xl border border-neutral-200 bg-white shadow-lg p-3 text-xs text-neutral-700">
                    <div>1) Уроки будуть додані до балансу з {String(toTutorName)}.</div>
                    <div className="mt-1">2) Ваші уроки з {String(fromTutorName)} залишаться доступними ({String(remaining)} уроків).</div>
                    <div className="mt-1">3) Ви зможете одразу запланувати уроки з новим викладачем.</div>
                  </div>
                ) : null}
              </div>
            </div>

          {step === "confirm" ? (
            <div className="mt-4">
              <div className="rounded-2xl border border-neutral-200 bg-neutral-50 p-4">
                <div className="flex items-center justify-center">
                  <div className="flex items-start gap-6 min-w-0">
                    <div className="flex flex-col items-center gap-1 min-w-0">
                      <div className="h-9 w-9 rounded-full bg-neutral-200 text-neutral-800 flex items-center justify-center text-xs font-semibold shrink-0">
                        {initials(String(fromTutorName))}
                      </div>
                      <div className="text-[11px] leading-4 text-neutral-700 font-medium truncate max-w-[92px]">{fromTutorName}</div>
                      <div className="text-[11px] leading-4 text-neutral-500 truncate max-w-[92px]">₴{money(perFrom).split(",")[0]} / урок</div>
                    </div>

                    <div className="pt-2 text-neutral-400 shrink-0">→</div>

                    <div className="flex flex-col items-center gap-1 min-w-0">
                      <div className="h-9 w-9 rounded-full bg-neutral-200 text-neutral-800 flex items-center justify-center text-xs font-semibold shrink-0">
                        {initials(String(toTutorName))}
                      </div>
                      <div className="text-[11px] leading-4 text-neutral-700 font-medium truncate max-w-[92px]">{toTutorName}</div>
                      <div className="text-[11px] leading-4 text-neutral-500 truncate max-w-[92px]">₴{money(perTo).split(",")[0]} / урок</div>
                    </div>
                  </div>
                </div>
                <div className="mt-2 flex items-center justify-between text-sm">
                  <div className="text-neutral-600">Залишок з {fromTutorName}</div>
                  <div className="font-semibold text-neutral-900">{preview.fromRemainingCredits} уроків</div>
                </div>

                <div className="mt-2 flex items-center justify-between text-sm">
                  <div className="text-neutral-600">Списано з балансу</div>
                  <div className="font-semibold text-neutral-900">{Math.max(0, Math.floor(Number(preview.fromDebitCredits) || 0))} урок(ів)</div>
                </div>

                {targetHasActiveSub ? (
                  <div className="mt-2 flex items-center justify-between text-sm">
                    <div className="text-neutral-600">Додано</div>
                    <div className="font-semibold text-neutral-900">{Math.max(0, Math.floor(Number(preview.toAddCredits) || 0))} урок(ів)</div>
                  </div>
                ) : null}

                <div className="mt-3 pt-3 border-t border-neutral-200 text-sm">
                  <div className="flex items-center justify-between">
                    <div className="text-neutral-600">Сума переказу</div>
                    <div className="font-semibold text-neutral-900">−₴{money(preview.valueCents)}</div>
                  </div>
                  {preview.toPayCents > 0 ? (
                    <div className="mt-2 flex items-center justify-between">
                      <div className="text-neutral-600">До сплати</div>
                      <div className="font-semibold text-red-600">₴{money(preview.toPayCents)}</div>
                    </div>
                  ) : null}
                  <div className="mt-2 flex items-center justify-between">
                    <div className="text-neutral-600">Комісія</div>
                    <div className="font-semibold text-neutral-900">₴{money(preview.feeCents)}</div>
                  </div>
                </div>
              </div>

              <div className="mt-4">
                <div className="text-sm font-semibold text-neutral-900">Скільки уроків переказати?</div>
                <div className="mt-2 flex items-center justify-between gap-3 rounded-2xl border border-neutral-200 bg-white p-3">
                  <button
                    type="button"
                    aria-label="Decrease"
                    disabled={loading || creditsToTransfer <= 1}
                    onClick={() => setCreditsToTransfer((v) => Math.max(1, Math.floor(Number(v) || 1) - 1))}
                    className={
                      loading || creditsToTransfer <= 1
                        ? "h-10 w-10 rounded-xl border border-neutral-200 bg-neutral-100 text-neutral-400"
                        : "h-10 w-10 rounded-xl border border-neutral-200 bg-white text-neutral-900 hover:bg-neutral-50"
                    }
                  >
                    −
                  </button>

                  <div className="flex-1 text-center">
                    <div className="text-3xl font-semibold text-neutral-900 tabular-nums">
                      {Math.max(1, Math.floor(Number(creditsToTransfer) || 1))}
                    </div>
                    <div className="mt-0.5 text-xs text-neutral-500">максимум: {maxCredits}</div>
                  </div>

                  <button
                    type="button"
                    aria-label="Increase"
                    disabled={loading || creditsToTransfer >= maxCredits}
                    onClick={() => setCreditsToTransfer((v) => Math.min(maxCredits, Math.floor(Number(v) || 1) + 1))}
                    className={
                      loading || creditsToTransfer >= maxCredits
                        ? "h-10 w-10 rounded-xl border border-neutral-200 bg-neutral-100 text-neutral-400"
                        : "h-10 w-10 rounded-xl border border-neutral-200 bg-white text-neutral-900 hover:bg-neutral-50"
                    }
                  >
                    +
                  </button>
                </div>
                <div className="mt-2 text-xs text-neutral-500">Переказ можливий лише в межах доступного балансу.</div>
              </div>

            {err ? <div className="mt-3 text-sm text-red-600">{err}</div> : null}

            <button
              type="button"
              onClick={confirm}
              disabled={loading || creditsToTransfer <= 0 || payOpen}
              className={
                !loading
                  ? "mt-5 w-full h-12 rounded-2xl bg-black px-5 text-sm font-semibold text-white hover:bg-neutral-800"
                  : "mt-5 w-full h-12 rounded-2xl bg-neutral-200 px-5 text-sm font-semibold text-neutral-500 cursor-not-allowed"
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
      ) : null}
    </>
  );
}
