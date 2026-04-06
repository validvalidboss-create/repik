"use client";

import { useEffect, useMemo, useState } from "react";
import ContinueLessonsButton from "@/components/ContinueLessonsButton";

type ByTutorRow = {
  tutorId: string;
  tutorName: string;
  tutorImage: string | null;
  valueCents: number;
  credits: number;
  rateCents: number;
};

function moneyUAH(cents: number) {
  const v = Number(cents || 0) || 0;
  return Math.max(0, Math.round(v / 100));
}

function moneyUAHExact(cents: number) {
  const v = Number(cents || 0) || 0;
  const uah = Math.max(0, v / 100);
  return new Intl.NumberFormat("uk-UA", { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(uah);
}

export default function PayOrTransferFlow(props: {
  locale: string;
  toTutorId: string;
  toTutorName: string;
  toRateCents: number;
  buttonText?: string;
  onSuccessHref: string;
  autoSkipMethod?: boolean;
  startOpen?: boolean;
  hideTrigger?: boolean;
  onClose?: () => void;
}) {
  const {
    locale,
    toTutorId,
    toTutorName,
    toRateCents,
    buttonText = "Продовжити",
    onSuccessHref,
    autoSkipMethod = true,
    startOpen = false,
    hideTrigger = false,
    onClose,
  } = props;

  const [open, setOpen] = useState(false);
  const [payOpen, setPayOpen] = useState(false);
  const [step, setStep] = useState<"method" | "pickFrom" | "count" | "confirm" | "pickSecond" | "success">("method");
  const [method, setMethod] = useState<null | "transfer" | "pay">(null);
  const [transferKey, setTransferKey] = useState<string>("");
  const [byTutor, setByTutor] = useState<ByTutorRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState<string>("");
  const [payInitialLessons, setPayInitialLessons] = useState<number | undefined>(undefined);
  const [autoSkippedMethod, setAutoSkippedMethod] = useState(false);
  const [toTutorImage, setToTutorImage] = useState<string | null>(null);
  const [showAddBalanceHint, setShowAddBalanceHint] = useState(false);
  const [resumeAfterPay, setResumeAfterPay] = useState<null | {
    step: "method" | "pickFrom" | "count" | "confirm" | "pickSecond" | "success";
    method: null | "transfer" | "pay";
    fromTutor: ByTutorRow | null;
    lessonCount: number;
  }>(null);

  const [fromTutor, setFromTutor] = useState<ByTutorRow | null>(null);
  const [secondFromTutor, setSecondFromTutor] = useState<ByTutorRow | null>(null);
  const [autoFallbackDone, setAutoFallbackDone] = useState(false);
  const [lessonCount, setLessonCount] = useState<number>(4);

  function closeFlow() {
    setPayOpen(false);
    setOpen(false);
    try {
      onClose?.();
    } catch {
      // ignore
    }
  }

  function newTransferKey() {
    const rnd = typeof crypto !== "undefined" && "randomUUID" in crypto ? (crypto as any).randomUUID() : String(Date.now());
    return `money-transfer:${toTutorId}:${rnd}`;
  }

  useEffect(() => {
    if (!open) return;
    const y = window.scrollY || 0;
    const prev = {
      position: document.body.style.position,
      top: document.body.style.top,
      width: document.body.style.width,
      overflowY: document.body.style.overflowY,
    };
    document.body.style.position = "fixed";
    document.body.style.top = `-${y}px`;
    document.body.style.width = "100%";
    document.body.style.overflowY = "scroll";
    return () => {
      const top = document.body.style.top;
      document.body.style.position = prev.position;
      document.body.style.top = prev.top;
      document.body.style.width = prev.width;
      document.body.style.overflowY = prev.overflowY;
      const restoreY = Math.abs(parseInt(top || "0", 10)) || y;
      window.scrollTo(0, restoreY);
    };
  }, [open]);

  useEffect(() => {
    if (!open) return;
    if (transferKey) return;
    setTransferKey(newTransferKey());
  }, [open, toTutorId, transferKey]);

  useEffect(() => {
    if (!startOpen) return;
    setTransferKey(newTransferKey());
    setOpen(true);
  }, [startOpen]);

  useEffect(() => {
    if (!open) return;
    if (resumeAfterPay) {
      setStep(resumeAfterPay.step);
      setMethod(resumeAfterPay.method);
      setErr("");
      setFromTutor(resumeAfterPay.fromTutor);
      setSecondFromTutor(null);
      setLessonCount(resumeAfterPay.lessonCount);
      setPayInitialLessons(undefined);
      setAutoSkippedMethod(false);
      setResumeAfterPay(null);
      return;
    }

    setStep("method");
    setMethod(null);
    setErr("");
    setFromTutor(null);
    setSecondFromTutor(null);
    setAutoFallbackDone(false);
    setLessonCount(4);
    setPayInitialLessons(undefined);
    setAutoSkippedMethod(false);
  }, [open]);

  useEffect(() => {
    if (!open) return;
    if (method) return;
    if (!autoSkipMethod) return;
    const transferSourcesAvailable = byTutor.length > 0;
    if (!transferSourcesAvailable) return;
    // UX: if user has a balance, default to using it (skip the extra decision screen).
    setMethod("transfer");
    setStep("pickFrom");
    setAutoSkippedMethod(true);
  }, [open, method, byTutor.length, autoSkipMethod]);

  useEffect(() => {
    if (!payOpen) return;
    setErr("");
  }, [payOpen]);

  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    async function loadToTutorImage() {
      try {
        const res = await fetch(`/api/tutors/${encodeURIComponent(String(toTutorId))}`, { cache: "no-store" });
        const data = await res.json().catch(() => null);
        const img = String(data?.tutor?.user?.image || data?.tutor?.media?.[0] || data?.user?.image || "").trim();
        if (!cancelled) setToTutorImage(img || null);
      } catch {
        if (!cancelled) setToTutorImage(null);
      }
    }
    loadToTutorImage();
    return () => {
      cancelled = true;
    };
  }, [open, toTutorId]);

  useEffect(() => {
    if (!open) return;
    let mounted = true;
    async function load() {
      try {
        const res = await fetch("/api/lesson-balance", { cache: "no-store" });
        const json = await res.json().catch(() => null);
        if (!mounted) return;
        if (!res.ok || !json?.ok) {
          setByTutor([]);
          return;
        }
        const list = Array.isArray(json?.byTutor) ? (json.byTutor as ByTutorRow[]) : [];
        const filtered =
          list
            .filter((x) => String(x?.tutorId || "") && String(x?.tutorId || "") !== String(toTutorId))
            .filter((x) => {
              const credits = Math.max(0, Math.floor(Number((x as any)?.credits ?? 0) || 0));
              const valueCents = Math.max(0, Math.floor(Number((x as any)?.valueCents ?? 0) || 0));
              return credits > 0 || valueCents > 0;
            });

        setByTutor(filtered);

        // If there are no transfer sources, skip this modal and open the regular payment flow.
        if (!autoFallbackDone && filtered.length === 0) {
          setAutoFallbackDone(true);
          setOpen(false);
          setPayOpen(true);
        }
      } catch {
        if (!mounted) return;
        setByTutor([]);
      }
    }
    load();
    return () => {
      mounted = false;
    };
  }, [open, toTutorId]);

  const toLessonUAH = moneyUAH(toRateCents);
  const hasTransferSources = byTutor.length > 0;

  const totalNeedCents = Math.max(0, (Number(toRateCents) || 0) * (Math.max(4, Math.min(20, Math.floor(Number(lessonCount) || 0)))));
  const extraPayCents = useMemo(() => {
    if (!fromTutor) return 0;
    const a = Math.max(0, Math.floor(Number(fromTutor.valueCents || 0) || 0));
    const b = Math.max(0, Math.floor(Number(secondFromTutor?.valueCents || 0) || 0));
    return Math.max(0, totalNeedCents - (a + b));
  }, [fromTutor, secondFromTutor, totalNeedCents]);

  const extraPayCentsAfterFirst = useMemo(() => {
    if (!fromTutor) return 0;
    const a = Math.max(0, Math.floor(Number(fromTutor.valueCents || 0) || 0));
    return Math.max(0, totalNeedCents - a);
  }, [fromTutor, totalNeedCents]);

  const canAddSecondBalance = useMemo(() => {
    if (!fromTutor) return false;
    if (secondFromTutor) return false;
    if (extraPayCentsAfterFirst <= 0) return false;
    return byTutor.some((x) => String(x.tutorId) !== String(fromTutor.tutorId));
  }, [fromTutor, secondFromTutor, extraPayCentsAfterFirst, byTutor]);

  const splitPreview = useMemo(() => {
    if (!fromTutor || !secondFromTutor) return null;
    const toCreditsToAdd = Math.max(4, Math.min(20, Math.floor(Number(lessonCount) || 0)));
    const toRate = Number(toRateCents || 0) || 0;
    if (toRate <= 0) return null;
    const value1 = Math.min(Math.floor((Number(fromTutor.valueCents || 0) || 0) / toRate), toCreditsToAdd) * toRate;
    const value2 = Math.max(0, toCreditsToAdd * toRate - value1);
    const ok = value1 > 0 && value2 > 0 && value2 <= (Number(secondFromTutor.valueCents || 0) || 0);
    return {
      ok,
      toCreditsToAdd,
      toRate,
      value1,
      value2,
      shortageCents: Math.max(0, value2 - (Number(secondFromTutor.valueCents || 0) || 0)),
    };
  }, [fromTutor, secondFromTutor, lessonCount, toRateCents]);

  const transferPreview = useMemo(() => {
    if (!fromTutor) return null;
    const fromRate = Number(fromTutor.rateCents || 0) || 0;
    const fromCredits = Number(fromTutor.credits || 0) || 0;
    if (fromRate <= 0 || fromCredits <= 0 || toRateCents <= 0) return null;

    const toCreditsToAdd = Math.max(4, Math.min(20, Math.floor(Number(lessonCount) || 0)));
    const needValueCents = toRateCents * toCreditsToAdd;
    const fromValueCents = fromCredits * fromRate;
    if (fromValueCents < needValueCents) {
      return {
        ok: false as const,
        fromValueCents,
        needValueCents,
        transferableValueCents: fromValueCents,
        shortageCents: Math.max(0, needValueCents - fromValueCents),
        fromCreditsToDebit: 0,
        toCreditsToAdd,
        remainingValueCents: fromValueCents,
      };
    }

    const valueCentsToTransfer = toCreditsToAdd * toRateCents;
    const fromCreditsToDebit = Math.ceil(valueCentsToTransfer / fromRate);
    if (fromCreditsToDebit <= 0 || fromCreditsToDebit > fromCredits) {
      return {
        ok: false as const,
        fromValueCents,
        needValueCents: valueCentsToTransfer,
        transferableValueCents: fromValueCents,
        shortageCents: 0,
        fromCreditsToDebit: 0,
        toCreditsToAdd,
        remainingValueCents: fromValueCents,
      };
    }

    const remainingValueCents = Math.max(0, fromValueCents - fromCreditsToDebit * fromRate);
    return {
      ok: true as const,
      fromValueCents,
      needValueCents: valueCentsToTransfer,
      transferableValueCents: valueCentsToTransfer,
      shortageCents: 0,
      fromCreditsToDebit,
      toCreditsToAdd,
      remainingValueCents,
    };
  }, [fromTutor, toRateCents, lessonCount]);

  const confirmBreakdown = useMemo(() => {
    const toCreditsToAdd = Math.max(4, Math.min(20, Math.floor(Number(lessonCount) || 0)));
    const needValueCents = Math.max(0, (Number(toRateCents) || 0) * toCreditsToAdd);
    if (!fromTutor) return null;

    if (secondFromTutor && splitPreview) {
      const remain1 = Math.max(0, (Number(fromTutor.valueCents || 0) || 0) - (Number(splitPreview.value1) || 0));
      const remain2 = Math.max(0, (Number(secondFromTutor.valueCents || 0) || 0) - (Number(splitPreview.value2) || 0));
      return {
        toCreditsToAdd,
        needValueCents,
        rows: [
          { label: `Баланс з ${fromTutor.tutorName}`, valueCents: Number(splitPreview.value1) || 0 },
          { label: `Баланс з ${secondFromTutor.tutorName}`, valueCents: Number(splitPreview.value2) || 0 },
          { label: `50-хв урок(и) з ${toTutorName}`, valueCents: needValueCents },
          { label: `Залишок на балансі з ${fromTutor.tutorName}`, valueCents: remain1 },
          { label: `Залишок на балансі з ${secondFromTutor.tutorName}`, valueCents: remain2 },
        ],
      };
    }

    if (transferPreview) {
      return {
        toCreditsToAdd,
        needValueCents,
        rows: [
          { label: `Баланс з ${fromTutor.tutorName}`, valueCents: Number(transferPreview.fromValueCents) || 0 },
          { label: `50-хв урок(и) з ${toTutorName}`, valueCents: Number(transferPreview.needValueCents) || 0 },
          { label: `Залишок на балансі з ${fromTutor.tutorName}`, valueCents: Number(transferPreview.remainingValueCents) || 0 },
        ],
      };
    }

    return null;
  }, [fromTutor, secondFromTutor, splitPreview, transferPreview, lessonCount, toRateCents, toTutorName]);

  const shortageInitialLessons = useMemo(() => {
    const shortageCents = Math.max(0, Math.floor(Number(transferPreview?.shortageCents ?? 0) || 0));
    if (!Number.isFinite(shortageCents) || shortageCents <= 0) return undefined;
    const perLesson = Math.max(1, Math.floor(Number(toRateCents) || 0));
    const needLessons = Math.ceil(shortageCents / perLesson);
    return Math.max(1, Math.min(20, needLessons));
  }, [transferPreview?.shortageCents, toRateCents]);

  const partialTransferPlan = useMemo(() => {
    if (!fromTutor) return null;
    const toRate = Number(toRateCents || 0) || 0;
    if (toRate <= 0) return null;
    const desiredCredits = Math.max(4, Math.min(20, Math.floor(Number(lessonCount) || 0)));
    const fromValue = Math.max(0, Math.floor(Number(transferPreview?.fromValueCents ?? fromTutor.valueCents ?? 0) || 0));
    const transferableCredits = Math.max(0, Math.min(desiredCredits, Math.floor(fromValue / toRate)));
    const valueCents = transferableCredits * toRate;
    const remainingCredits = Math.max(0, desiredCredits - transferableCredits);
    const remainderValueCents = Math.max(0, fromValue - valueCents);
    return { desiredCredits, transferableCredits, valueCents, remainingCredits, remainderValueCents };
  }, [fromTutor, transferPreview?.fromValueCents, toRateCents, lessonCount]);

  const topupLessons = useMemo(() => {
    const byCredits = Math.max(0, Math.floor(Number(partialTransferPlan?.remainingCredits ?? 0) || 0));
    if (byCredits > 0) return byCredits;
    const byShortage = Math.max(0, Math.floor(Number(shortageInitialLessons ?? 0) || 0));
    return byShortage > 0 ? byShortage : 0;
  }, [partialTransferPlan?.remainingCredits, shortageInitialLessons]);

  const topupPackage = useMemo(() => {
    const lessons = Math.max(1, Math.min(20, Math.floor(Number(topupLessons || 0) || 0)));
    if (!Number.isFinite(lessons) || lessons <= 0) return null;
    const priceCents = Math.max(0, Math.floor(Number(toRateCents || 0) || 0));
    const subtotalCents = lessons * priceCents;
    const feeCents = Math.round(subtotalCents * 0.02);
    const totalCents = subtotalCents + feeCents;
    return { lessons, priceCents, subtotalCents, feeCents, totalCents };
  }, [topupLessons, toRateCents]);

  async function transferThenTopup() {
    if (!fromTutor) return;
    if (!transferKey) return;
    if (!partialTransferPlan) return;
    if (loading) return;

    setLoading(true);
    setErr("");
    try {
      if (partialTransferPlan.valueCents > 0) {
        const res = await fetch("/api/credits/transfer", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({
            mode: "money",
            fromTutorId: String(fromTutor.tutorId),
            toTutorId: String(toTutorId),
            valueCents: Number(partialTransferPlan.valueCents),
            transferKey: `${transferKey}:partial`,
          }),
        });
        const json = await res.json().catch(() => null);
        if (!res.ok || !json?.ok) throw new Error(String(json?.error || "Не вдалося виконати переказ"));
      }

      try {
        window.dispatchEvent(new Event("lesson-balance-changed"));
      } catch {
        // ignore
      }

      if (partialTransferPlan.remainingCredits > 0) {
        setPayInitialLessons(partialTransferPlan.remainingCredits);
        setResumeAfterPay({ step: "confirm", method, fromTutor, lessonCount });
        setOpen(false);
        setPayOpen(true);
      } else {
        setOpen(false);
        try {
          if (onSuccessHref) {
            const base = String(onSuccessHref || "");
            const sep = base.includes("?") ? "&" : "?";
            window.location.href = `${base}${sep}transferKey=${encodeURIComponent(String(transferKey))}&notice=transfer_ok`;
          }
        } catch {
          // ignore
        }
      }
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Не вдалося виконати переказ");
    } finally {
      setLoading(false);
    }
  }

  async function confirmTransfer() {
    if (!fromTutor) return;
    if (!transferKey) return;
    const useSplit = Boolean(secondFromTutor);
    if (useSplit) {
      if (!splitPreview?.ok) return;
    } else {
      if (!transferPreview?.ok) return;
    }
    if (loading) return;

    setLoading(true);
    setErr("");
    try {
      if (useSplit && secondFromTutor && splitPreview) {
        const res1 = await fetch("/api/credits/transfer", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({
            mode: "money",
            fromTutorId: String(fromTutor.tutorId),
            toTutorId: String(toTutorId),
            valueCents: Number(splitPreview.value1),
            transferKey: `${transferKey}:1`,
          }),
        });
        const json1 = await res1.json().catch(() => null);
        if (!res1.ok || !json1?.ok) throw new Error(String(json1?.error || "Не вдалося виконати переказ"));

        const res2 = await fetch("/api/credits/transfer", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({
            mode: "money",
            fromTutorId: String(secondFromTutor.tutorId),
            toTutorId: String(toTutorId),
            valueCents: Number(splitPreview.value2),
            transferKey: `${transferKey}:2`,
          }),
        });
        const json2 = await res2.json().catch(() => null);
        if (!res2.ok || !json2?.ok) throw new Error(String(json2?.error || "Не вдалося виконати переказ"));
      } else {
        const res = await fetch("/api/credits/transfer", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({
            mode: "money",
            fromTutorId: String(fromTutor.tutorId),
            toTutorId: String(toTutorId),
            valueCents: Number(transferPreview?.needValueCents),
            transferKey,
          }),
        });
        const json = await res.json().catch(() => null);
        if (!res.ok || !json?.ok) throw new Error(String(json?.error || "Не вдалося виконати переказ"));
      }
      try {
        window.dispatchEvent(new Event("lesson-balance-changed"));
      } catch {
        // ignore
      }
      setOpen(false);
      try {
        if (onSuccessHref) {
          const base = String(onSuccessHref || "");
          const sep = base.includes("?") ? "&" : "?";
          window.location.href = `${base}${sep}transferKey=${encodeURIComponent(String(transferKey))}&notice=transfer_ok`;
        }
      } catch {
        // ignore
      }
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Не вдалося виконати переказ");
    } finally {
      setLoading(false);
    }
  }

  if (!toTutorId) return null;

  return (
    <>
      {!hideTrigger && !open && !payOpen ? (
        <button
          type="button"
          className="inline-flex h-11 w-full items-center justify-center rounded-xl bg-primary px-4 text-sm font-semibold text-primary-foreground hover:opacity-90"
          onClick={() => {
            setTransferKey(newTransferKey());
            setOpen(true);
          }}
        >
          {buttonText}
        </button>
      ) : null}

      {payOpen ? (
        <ContinueLessonsButton
          locale={String(locale)}
          tutorId={String(toTutorId)}
          tutorName={String(toTutorName)}
          pricePerLessonUAH={toLessonUAH}
          variant="pink"
          buttonText="Оплатити"
          startOpen
          hideTrigger
          initialLessons={payInitialLessons}
          openMode="topup"
          onSuccess={() => {
            try {
              window.dispatchEvent(new Event("lesson-balance-changed"));
            } catch {
              // ignore
            }
            setPayOpen(false);
            try {
              if (onSuccessHref) {
                const base = String(onSuccessHref || "");
                const sep = base.includes("?") ? "&" : "?";
                window.location.href = `${base}${sep}transferKey=${encodeURIComponent(String(transferKey))}&notice=topup_ok`;
              }
            } catch {
              // ignore
            }
          }}
          onClose={() => {
            // If we opened payOpen as a continuation of a transfer flow (partial top-up),
            // allow returning back to the transfer modal. Otherwise close the flow.
            if (resumeAfterPay) {
              setPayOpen(false);
              setOpen(true);
              return;
            }
            closeFlow();
          }}
        />
      ) : null}

      {open ? (
        <div
          className="fixed inset-0 z-[10000] flex items-center justify-center bg-black/60 backdrop-blur-sm px-4"
          onMouseDown={(e) => {
            if (e.target === e.currentTarget) closeFlow();
          }}
        >
          <div className="w-full max-w-md max-h-[85vh] rounded-3xl bg-white shadow-2xl border border-neutral-200 p-5 flex flex-col">
            <div className="relative flex items-center justify-between gap-3">
              {step === "method" ? (
                <div className="h-10 w-10" />
              ) : (
                <button
                  type="button"
                  className="inline-flex h-10 w-10 items-center justify-center rounded-full hover:bg-neutral-100 text-neutral-800"
                  onClick={() => {
                    if (step === "pickFrom") {
                      if (autoSkippedMethod) {
                        setOpen(false);
                        return;
                      }
                      setStep("method");
                      setMethod(null);
                      setFromTutor(null);
                      setSecondFromTutor(null);
                    } else if (step === "confirm") {
                      setStep("count");
                    } else if (step === "count") {
                      setStep("pickFrom");
                    } else if (step === "success") {
                      setOpen(false);
                    }
                  }}
                  aria-label="Back"
                >
                  ←
                </button>
              )}

              <div className="absolute left-0 right-0 text-center pointer-events-none">
                <div className="text-base font-semibold text-neutral-900">
                  {step === "method"
                    ? "Як ви хочете сплатити?"
                    : step === "pickFrom"
                      ? "Використати мій баланс"
                      : step === "count"
                        ? "Скільки уроків заплануємо?"
                        : step === "pickSecond"
                          ? "Другий баланс"
                      : step === "confirm"
                        ? "Перевірте деталі переказу"
                        : "Успішно"}
                </div>
              </div>

              <button
                type="button"
                className="inline-flex h-10 w-10 items-center justify-center rounded-full hover:bg-neutral-100 text-neutral-800"
                onClick={closeFlow}
                aria-label="Close"
              >
                ✕
              </button>
            </div>

            <div className="mt-4 flex-1 overflow-y-auto pr-1">
              {step !== "method" && step !== "pickFrom" && step !== "confirm" ? (
                <div className="mb-3 rounded-2xl border border-neutral-200 bg-white p-3">
                  <div className="flex items-center justify-between gap-3">
                    <div className="flex min-w-0 items-center gap-3">
                      <div className="flex items-center">
                        {fromTutor ? (
                          <div className="h-9 w-9 overflow-hidden rounded-2xl ring-1 ring-neutral-200 bg-white text-neutral-700 flex items-center justify-center text-[10px] font-semibold">
                            {fromTutor.tutorImage ? (
                              // eslint-disable-next-line @next/next/no-img-element
                              <img src={fromTutor.tutorImage} alt="" className="h-full w-full object-cover" />
                            ) : (
                              String(fromTutor.tutorName || "").slice(0, 2).toUpperCase()
                            )}
                          </div>
                        ) : (
                          <div className="h-9 w-9 rounded-2xl border border-neutral-200 bg-white" />
                        )}
                        <div className="mx-2 text-neutral-300">→</div>
                        <div className="h-9 w-9 overflow-hidden rounded-2xl ring-1 ring-neutral-200 bg-white text-neutral-700 flex items-center justify-center text-[10px] font-semibold">
                          {toTutorImage ? (
                            // eslint-disable-next-line @next/next/no-img-element
                            <img src={toTutorImage} alt="" className="h-full w-full object-cover" />
                          ) : (
                            String(toTutorName || "").slice(0, 2).toUpperCase()
                          )}
                        </div>
                      </div>
                      <div className="min-w-0">
                        <div className="truncate text-sm font-semibold text-neutral-900">{toTutorName}</div>
                        <div className="mt-0.5 text-xs text-neutral-600">цільовий викладач</div>
                      </div>
                    </div>
                    <div className="flex-shrink-0 flex items-center justify-end gap-2">
                      <div className="text-right">
                        <div className="text-xs text-neutral-600">ціна</div>
                        <div className="text-sm font-semibold text-neutral-900 whitespace-nowrap">₴{toLessonUAH}</div>
                      </div>
                    </div>
                  </div>
                </div>
              ) : null}


              {step === "method" ? (
                <div className="space-y-3">
                  {hasTransferSources ? (
                    <button
                      type="button"
                      className="w-full rounded-2xl border border-neutral-200 bg-white p-4 text-left hover:bg-neutral-50"
                      onClick={() => {
                        setMethod("transfer");
                        setStep("pickFrom");
                      }}
                    >
                      <div className="text-sm font-semibold text-neutral-900">Використати мої уроки</div>
                      <div className="mt-1 text-xs text-neutral-600">Ви можете використати оплачений баланс з іншими викладачами.</div>
                    </button>
                  ) : null}

                  <button
                    type="button"
                    className="w-full rounded-2xl border border-neutral-200 bg-white p-4 text-left hover:bg-neutral-50"
                    onClick={() => {
                      setMethod("pay");
                      setOpen(false);
                      setPayOpen(true);
                    }}
                  >
                    <div className="text-sm font-semibold text-neutral-900">Оплатити карткою</div>
                    <div className="mt-1 text-xs text-neutral-600">Швидка оплата та миттєве поповнення балансу</div>
                  </button>
                </div>
              ) : null}

              {step === "count" ? (
                <div>
                  <div className="rounded-2xl border border-neutral-200 bg-white p-4">
                    <div className="text-sm font-semibold text-neutral-900">Оберіть кількість уроків</div>
                    <div className="mt-1 text-xs text-neutral-600">Мінімум 4 уроки на місяць</div>

                    <div className="mt-4 flex items-end justify-between gap-4">
                      <div className="text-sm text-neutral-700">Кількість</div>
                      <div className="text-2xl font-semibold text-neutral-900 tabular-nums">{lessonCount}</div>
                    </div>

                    <input
                      type="range"
                      min={4}
                      max={20}
                      step={1}
                      value={lessonCount}
                      onChange={(e) => setLessonCount(Math.max(4, Math.min(20, Number(e.target.value) || 4)))}
                      className="mt-3 w-full accent-black"
                      aria-label="Lesson count"
                    />

                    <div className="mt-4 rounded-2xl border border-neutral-200 bg-neutral-50 p-4">
                      <div className="text-sm font-semibold text-neutral-900">Підсумок</div>
                      <div className="mt-2 text-sm text-neutral-700">
                        {lessonCount} уроків × ₴{toLessonUAH} = <span className="font-semibold text-neutral-900">₴{moneyUAHExact(toRateCents * lessonCount)}</span>
                      </div>

                      {fromTutor ? (
                        <div className="mt-3 space-y-2 text-sm">
                          <div className="flex items-center justify-between gap-4">
                            <div className="text-neutral-600 truncate">Баланс</div>
                            <div className="font-semibold text-neutral-700 whitespace-nowrap">−₴{moneyUAHExact(Number(fromTutor.valueCents || 0) || 0)}</div>
                          </div>

                          {secondFromTutor ? (
                            <div className="flex items-center justify-between gap-4">
                              <div className="text-neutral-600 truncate">Другий баланс</div>
                              <button
                                type="button"
                                className="inline-flex items-center gap-2 rounded-xl border border-neutral-200 bg-white px-3 py-1.5 hover:bg-neutral-50"
                                onClick={() => setSecondFromTutor(null)}
                              >
                                <span className="text-sm font-semibold text-neutral-900 truncate max-w-[170px]">{secondFromTutor.tutorName}</span>
                                <span className="text-sm font-semibold text-neutral-700 whitespace-nowrap">₴{moneyUAHExact(secondFromTutor.valueCents)}</span>
                                <span className="text-neutral-500">✕</span>
                              </button>
                            </div>
                          ) : null}

                          {extraPayCents > 0 ? (
                            <div className="pt-2 border-t border-neutral-200 flex items-center justify-between gap-4">
                              <div className="text-neutral-600 truncate">До оплати</div>
                              <div className="font-semibold text-red-600 whitespace-nowrap">₴{moneyUAHExact(extraPayCents)}</div>
                            </div>
                          ) : (
                            <div className="pt-2 border-t border-neutral-200 flex items-center justify-between gap-4">
                              <div className="text-neutral-600 truncate">До оплати</div>
                              <div className="font-semibold text-neutral-900 whitespace-nowrap">₴0</div>
                            </div>
                          )}
                        </div>
                      ) : null}
                    </div>
                  </div>

                  <button
                    type="button"
                    disabled={!fromTutor}
                    onClick={() => setStep("confirm")}
                    className={
                      fromTutor
                        ? "mt-5 w-full h-12 rounded-2xl bg-primary px-5 text-sm font-semibold text-primary-foreground hover:opacity-90"
                        : "mt-5 w-full h-12 rounded-2xl bg-neutral-200 px-5 text-sm font-semibold text-neutral-500 cursor-not-allowed"
                    }
                  >
                    Далі
                  </button>
                </div>
              ) : null}

              {step === "pickFrom" ? (
                <div>
                  <div className="text-sm text-neutral-600">Оберіть, з якого викладача використати баланс</div>

                  <div className="mt-3 space-y-2">
                    {byTutor.length ? (
                      byTutor.map((t) => {
                        const img = t.tutorImage;
                        const name = String(t.tutorName || "Викладач");
                        const uah = moneyUAH(t.valueCents);
                        return (
                          <button
                            key={String(t.tutorId)}
                            type="button"
                            className="w-full flex items-center justify-between gap-3 rounded-2xl border border-neutral-200 bg-white p-3 hover:bg-neutral-50"
                            onClick={() => {
                              setFromTutor(t);
                              setLessonCount(4);
                              setStep("count");
                            }}
                          >
                            <div className="flex min-w-0 items-center gap-3">
                              <div className="h-10 w-10 overflow-hidden rounded-2xl ring-1 ring-neutral-200 bg-white text-neutral-700 flex items-center justify-center text-xs font-semibold">
                                {img ? (
                                  // eslint-disable-next-line @next/next/no-img-element
                                  <img src={img} alt="" className="h-full w-full object-cover" />
                                ) : (
                                  name.slice(0, 2).toUpperCase()
                                )}
                              </div>
                              <div className="min-w-0 text-left">
                                <div className="truncate text-sm font-semibold text-neutral-900">{name}</div>
                                <div className="mt-0.5 text-xs text-neutral-600">перевести ₴{uah}</div>
                              </div>
                            </div>
                            <div className="text-neutral-400">›</div>
                          </button>
                        );
                      })
                    ) : (
                      <div className="mt-4 text-sm text-neutral-600">Немає балансу для переказу.</div>
                    )}
                  </div>
                </div>
              ) : null}

              {step === "confirm" ? (
                <div>
                  {fromTutor && transferPreview ? (
                    <>
                      {confirmBreakdown ? (
                        <div className="rounded-2xl border border-neutral-200 bg-white p-4">
                          <div className="space-y-2 text-sm">
                            {confirmBreakdown.rows.map((r, idx) => {
                              const isNeed = idx === 2;
                              return (
                                <div key={idx} className="flex items-center justify-between gap-4">
                                  <div className="text-neutral-600 truncate">{r.label}</div>
                                  <div className={isNeed ? "font-semibold text-neutral-900 whitespace-nowrap" : "font-semibold text-neutral-700 whitespace-nowrap"}>
                                    ₴{moneyUAHExact(r.valueCents)}
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                        </div>
                      ) : null}

                      <div className="mt-4 rounded-2xl border border-neutral-200 bg-white p-4">
                        <div className="text-sm font-semibold text-neutral-900">Що далі?</div>
                        <div className="mt-2 text-sm text-neutral-700 space-y-2">
                          <div>
                            1) Ви отримаєте{" "}
                            <span className="font-semibold text-neutral-900">
                              {secondFromTutor && splitPreview ? splitPreview.toCreditsToAdd : transferPreview.toCreditsToAdd} уроків
                            </span>{" "}
                            з <span className="font-semibold text-neutral-900">{toTutorName}</span>.
                          </div>
                          <div>
                            2) Баланс з <span className="font-semibold text-neutral-900">{fromTutor.tutorName}</span> залишиться доступним.
                          </div>
                          <div>
                            3) Після підтвердження ви одразу перейдете до <span className="font-semibold text-neutral-900">графіку</span> та зможете запланувати урок.
                          </div>
                        </div>
                      </div>

                      {err ? <div className="mt-3 text-sm text-red-600">{err}</div> : null}

                      {(!secondFromTutor && !transferPreview.ok) || (secondFromTutor && !splitPreview?.ok) ? (
                        <div className="mt-4 rounded-2xl border border-neutral-200 bg-neutral-50 p-4">
                          <div className="text-sm font-semibold text-neutral-900">Недостатньо балансу</div>
                          <div className="mt-2 text-sm text-neutral-700">
                            Доступно: <span className="font-semibold text-neutral-900">₴{moneyUAHExact(transferPreview.fromValueCents)}</span>
                            {" "}
                            · потрібно:{" "}
                            <span className="font-semibold text-neutral-900">
                              ₴{moneyUAHExact(
                                secondFromTutor && splitPreview ? splitPreview.toCreditsToAdd * splitPreview.toRate : transferPreview.needValueCents,
                              )}
                            </span>
                          </div>
                          {Number((secondFromTutor && splitPreview ? splitPreview.shortageCents : transferPreview.shortageCents) || 0) > 0 ? (
                            <div className="mt-2 rounded-xl border border-neutral-200 bg-white px-3 py-2 text-sm text-neutral-800">
                              Не вистачає:{" "}
                              <span className="font-semibold text-neutral-900">
                                ₴{moneyUAHExact(secondFromTutor && splitPreview ? splitPreview.shortageCents : transferPreview.shortageCents)}
                              </span>
                            </div>
                          ) : null}

                          {partialTransferPlan && partialTransferPlan.remainderValueCents > 0 && partialTransferPlan.remainderValueCents < Number(toRateCents || 0) ? (
                            <div className="mt-2 text-xs text-neutral-600">
                              Після переказу може залишитися малий залишок на балансі з {fromTutor.tutorName} (менше ціни 1 уроку) — його неможливо конвертувати в уроки без гаманця в ₴.
                            </div>
                          ) : null}

                          {topupPackage ? (
                            <div className="mt-2 text-xs text-neutral-600">
                              Доплата робиться покупкою цілих уроків (частково оплатити 1 урок неможливо).
                              {" "}
                              Балансом ми перенесемо{" "}
                              <span className="font-semibold text-neutral-900">{partialTransferPlan ? partialTransferPlan.transferableCredits : 0}</span>
                              {" "}
                              урок(ів), а щоб разом вийшло{" "}
                              <span className="font-semibold text-neutral-900">{partialTransferPlan ? partialTransferPlan.desiredCredits : Math.max(4, Math.min(20, Math.floor(Number(lessonCount) || 0)))}</span>
                              {" "}
                              урок(ів) — докупимо ще{" "}
                              <span className="font-semibold text-neutral-900">{topupPackage.lessons}</span>
                              {" "}
                              урок(ів) + 2% комісію:
                              {" "}
                              <span className="font-semibold text-neutral-900">
                                ₴{moneyUAHExact(topupPackage.subtotalCents)}
                              </span>
                              {" "}
                              + 2% (
                              <span className="font-semibold text-neutral-900">₴{moneyUAHExact(topupPackage.feeCents)}</span>
                              ) = {" "}
                              <span className="font-semibold text-neutral-900">₴{moneyUAHExact(topupPackage.totalCents)}</span>
                            </div>
                          ) : null}

                          <button
                            type="button"
                            onClick={transferThenTopup}
                            className="mt-4 inline-flex w-full h-12 items-center justify-center rounded-2xl bg-primary px-5 text-sm font-semibold text-primary-foreground hover:opacity-90 disabled:bg-neutral-200 disabled:text-neutral-500"
                            disabled={loading || !partialTransferPlan}
                          >
                            {topupPackage ? `Доплатити ₴${moneyUAHExact(topupPackage.totalCents)}` : "Доплатити"}
                          </button>
                        </div>
                      ) : null}

                      <button
                        type="button"
                        disabled={loading || !(secondFromTutor ? splitPreview?.ok : transferPreview.ok)}
                        onClick={confirmTransfer}
                        className={
                          !loading && (secondFromTutor ? splitPreview?.ok : transferPreview.ok)
                            ? "mt-5 w-full h-12 rounded-2xl bg-primary px-5 text-sm font-semibold text-primary-foreground hover:opacity-90"
                            : "mt-5 w-full h-12 rounded-2xl bg-neutral-200 px-5 text-sm font-semibold text-neutral-500 cursor-not-allowed"
                        }
                      >
                        {loading ? "Переказуємо…" : "Підтвердити переказ"}
                      </button>
                    </>
                  ) : null}
                </div>
              ) : null}

              {step === "pickSecond" ? (
                <div>
                  <div className="text-sm text-neutral-600">Оберіть другого викладача</div>

                  <div className="mt-3 space-y-2">
                    {byTutor
                      .filter((x) => String(x.tutorId) !== String(fromTutor?.tutorId || ""))
                      .map((t) => {
                        const img = t.tutorImage;
                        const name = String(t.tutorName || "Викладач");
                        const uah = moneyUAH(t.valueCents);
                        const isSelected = String(secondFromTutor?.tutorId || "") === String(t.tutorId);
                        return (
                          <button
                            key={String(t.tutorId)}
                            type="button"
                            className="w-full flex items-center justify-between gap-3 rounded-2xl border border-neutral-200 bg-white p-3 hover:bg-neutral-50"
                            onClick={() => {
                              if (isSelected) setSecondFromTutor(null);
                              else setSecondFromTutor(t);
                            }}
                          >
                            <div className="flex min-w-0 items-center gap-3">
                              <div className="h-10 w-10 overflow-hidden rounded-2xl ring-1 ring-neutral-200 bg-white text-neutral-700 flex items-center justify-center text-xs font-semibold">
                                {img ? (
                                  // eslint-disable-next-line @next/next/no-img-element
                                  <img src={img} alt="" className="h-full w-full object-cover" />
                                ) : (
                                  name.slice(0, 2).toUpperCase()
                                )}
                              </div>
                              <div className="min-w-0 text-left">
                                <div className="truncate text-sm font-semibold text-neutral-900">{name}</div>
                                <div className="mt-0.5 text-xs text-neutral-600">доступно ₴{uah}</div>
                              </div>
                            </div>
                            {isSelected ? (
                              <div className="h-7 w-7 rounded-full bg-neutral-900 text-white flex items-center justify-center text-sm">✓</div>
                            ) : (
                              <div className="text-neutral-400">›</div>
                            )}
                          </button>
                        );
                      })}
                  </div>

                  <button
                    type="button"
                    onClick={() => {
                      setStep("count");
                    }}
                    className="mt-4 inline-flex w-full h-12 items-center justify-center rounded-2xl border border-neutral-200 bg-white px-5 text-sm font-semibold text-neutral-900 hover:bg-neutral-50"
                  >
                    {secondFromTutor ? "Далі" : "Назад"}
                  </button>
                </div>
              ) : null}

              {step === "success" ? (
                <div>
                  <div className="rounded-2xl bg-pink-50 border border-pink-200 p-4">
                    <div className="text-sm font-semibold text-neutral-900">Переказ здійснено</div>
                    <div className="mt-2 text-sm text-neutral-800">Урок додано до балансу з {toTutorName}.</div>
                  </div>

                  <button
                    type="button"
                    onClick={() => {
                      const base = String(onSuccessHref || "");
                      const sep = base.includes("?") ? "&" : "?";
                      window.location.href = `${base}${sep}transferKey=${encodeURIComponent(String(transferKey))}&notice=transfer_ok`;
                    }}
                    className="mt-5 inline-flex w-full h-12 items-center justify-center rounded-2xl bg-primary px-5 text-sm font-semibold text-primary-foreground hover:opacity-90"
                  >
                    Окей
                  </button>
                </div>
              ) : null}
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}
