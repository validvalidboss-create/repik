"use client";

import { useEffect, useMemo, useState } from "react";

export default function ContinueLessonsButton({
  locale,
  tutorId,
  tutorName,
  pricePerLessonUAH,
  variant = "primary",
  buttonText = "Продовжити заняття",
  startOpen = false,
  hideTrigger = false,
  initialLessons,
  openMode = "default",
  onSuccess,
  onClose,
}: {
  locale: string;
  tutorId: string;
  tutorName: string;
  pricePerLessonUAH: number;
  variant?: "primary" | "compact" | "pink";
  buttonText?: string;
  startOpen?: boolean;
  hideTrigger?: boolean;
  initialLessons?: number;
  openMode?: "default" | "topup";
  onSuccess?: (payload: { lessons: number; subtotal: number; fee: number; total: number }) => void;
  onClose?: () => void;
}) {
  const [open, setOpen] = useState(false);
  const [priceUAH, setPriceUAH] = useState<number>(Number(pricePerLessonUAH || 0) || 0);
  const [tutorImage, setTutorImage] = useState<string | null>(null);
  const [buyingKey, setBuyingKey] = useState<string>("");
  const [error, setError] = useState<string>("");
  const [step, setStep] = useState<"plans" | "checkout">("plans");
  const [selected, setSelected] = useState<null | { lessons: number; subtotal: number; fee: number; total: number }>(null);
  const [recommendedLessons, setRecommendedLessons] = useState<number | null>(null);
  const [paymentMethod, setPaymentMethod] = useState<string>("Apple Pay");
  const [planOpen, setPlanOpen] = useState<boolean>(true);
  const [payState, setPayState] = useState<"idle" | "processing" | "success">("idle");

  useEffect(() => {
    setPriceUAH(Number(pricePerLessonUAH || 0) || 0);
  }, [pricePerLessonUAH]);

  useEffect(() => {
    if (startOpen) setOpen(true);
  }, [startOpen]);

  useEffect(() => {
    if (!open) return;
    setStep("plans");
    setSelected(null);
    setRecommendedLessons(null);
    setError("");
    setBuyingKey("");
    setPlanOpen(true);
    setPayState("idle");
  }, [open]);

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
    async function ensurePrice() {
      if (priceUAH > 0) return;
      if (!tutorId) return;
      try {
        const res = await fetch(`/api/tutors/${encodeURIComponent(String(tutorId))}`);
        const data = await res.json();
        const rateCents = Number(data?.rateCents || 0) || 0;
        const uah = Math.max(0, Math.round(rateCents / 100));
        if (uah > 0) setPriceUAH(uah);
        else setPriceUAH(300);
      } catch {
        setPriceUAH(300);
      }
    }
    ensurePrice();
  }, [priceUAH, tutorId]);

  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    async function loadTutorImage() {
      try {
        const res = await fetch(`/api/tutors/${encodeURIComponent(String(tutorId))}`, { cache: "no-store" });
        const data = await res.json().catch(() => null);
        const img = String(data?.tutor?.user?.image || data?.tutor?.media?.[0] || data?.user?.image || "").trim();
        if (!cancelled) setTutorImage(img || null);
      } catch {
        if (!cancelled) setTutorImage(null);
      }
    }
    loadTutorImage();
    return () => {
      cancelled = true;
    };
  }, [open, tutorId]);

  const options = useMemo(() => {
    const base = [4, 8, 12, 16, 20];
    const desired = Number(initialLessons || 0) || 0;
    const custom = Number.isFinite(desired) ? Math.max(4, Math.min(20, Math.floor(desired))) : 0;
    const lessonsCounts = custom > 0 && !base.includes(custom) ? [...base, custom].sort((a, b) => a - b) : base;
    return lessonsCounts.map((lessons) => {
      const subtotal = lessons * (Number(priceUAH || 0) || 0);
      const fee = Math.round(subtotal * 0.02);
      const total = subtotal + fee;
      return { lessons, subtotal, fee, total };
    });
  }, [priceUAH, initialLessons]);

  useEffect(() => {
    if (!open) return;
    if (!initialLessons) return;
    if (!options.length) return;
    if (step !== "plans") return;
    if (selected) return;

    const desired = Math.max(1, Math.min(20, Math.floor(Number(initialLessons) || 0)));
    const picked = options.reduce((best, opt) => {
      const bestDist = Math.abs(best.lessons - desired);
      const dist = Math.abs(opt.lessons - desired);
      if (dist < bestDist) return opt;
      if (dist === bestDist && opt.lessons > best.lessons) return opt;
      return best;
    }, options[0]);
    setRecommendedLessons(picked.lessons);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, initialLessons, options]);

  async function startCheckout(opt: { lessons: number; subtotal: number; fee: number; total: number }) {
    setSelected(opt);
    setStep("checkout");
    setPlanOpen(false);
    setPayState("idle");
  }

  async function confirmAndPay() {
    if (!selected) return;
    const key = String(selected.lessons);
    setBuyingKey(key);
    setError("");
    try {
      if (!Number.isFinite(selected.total) || selected.total <= 0) {
        throw new Error("Сума до оплати дорівнює 0. Перевірте ціну репетитора.");
      }

      setPayState("processing");
      await new Promise((r) => setTimeout(r, 2000));

      const purchaseKey = `${String(tutorId)}:${String(selected.lessons)}:${Date.now()}`;
      const rateCents = Math.max(0, Math.round((Number(priceUAH || 0) || 0) * 100));
      const purchaseRes = await fetch("/api/lesson-packages/purchase", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ tutorId: String(tutorId), lessons: Number(selected.lessons), purchaseKey, rateCents }),
      });
      const purchaseData = await purchaseRes.json().catch(() => null);
      if (!purchaseRes.ok || !purchaseData?.ok) {
        throw new Error(String(purchaseData?.error || "Не вдалося нарахувати уроки після оплати"));
      }

      setPayState("success");
      try {
        window.dispatchEvent(new Event("lesson-balance-changed"));
        window.dispatchEvent(new Event("trial-balance-changed"));
      } catch {
        // ignore
      }

      try {
        onSuccess?.({ lessons: selected.lessons, subtotal: selected.subtotal, fee: selected.fee, total: selected.total });
      } catch {
        // ignore
      }
    } catch (e) {
      setBuyingKey("");
      setError(e instanceof Error ? e.message : "Не вдалося перейти до оплати");
      setPayState("idle");
    }
  }

  function goScheduleNow() {
    if (!selected) return;
    const perWeek = Math.max(1, Math.round(Number(selected.lessons || 0) / 4));
    const qp = new URLSearchParams({
      planPerWeek: String(perWeek),
      planWeeks: "4",
      planLessons: String(selected.lessons),
    });
    window.location.href = `/${locale}/schedule/${encodeURIComponent(String(tutorId))}?${qp.toString()}`;
  }

  function goScheduleLater() {
    const dashQp = new URLSearchParams({
      tab: "subscriptions",
      notice: "purchase_ok",
      dev_purchased: "1",
      dev_purchased_tutor: String(tutorId),
    });
    window.location.href = `/${locale}/dashboard?${dashQp.toString()}#schedule`;
  }

  return (
    <>
      {!hideTrigger ? (
        <button
          type="button"
          className={
            variant === "compact"
              ? "inline-flex h-10 items-center rounded-xl border border-neutral-200 bg-white px-3 text-sm font-semibold text-neutral-900 hover:bg-neutral-50"
              : variant === "pink"
                ? "w-full text-center bg-pink-500 text-white px-4 py-2.5 rounded-xl hover:bg-pink-600 transition-colors font-medium"
                : "w-full text-center bg-black text-white px-4 py-2.5 rounded-xl hover:bg-neutral-800 transition-colors font-medium"
          }
          onClick={() => setOpen(true)}
        >
          {buttonText}
        </button>
      ) : null}

      {open ? (
        <div className="fixed inset-0 z-[10000] flex items-center justify-center p-4" style={{ pointerEvents: "auto" }}>
          <button
            type="button"
            className="absolute inset-0 w-full h-full bg-black/50 backdrop-blur-sm"
            aria-label="Close"
            onClick={() => setOpen(false)}
          />

          <div
            className="relative w-[92vw] max-w-lg bg-white rounded-2xl shadow-2xl border border-neutral-200 overflow-hidden flex flex-col"
            style={{ height: 560, minHeight: 420, maxHeight: "78vh" } as any}
          >
            <div className="px-5 py-4 border-b flex items-center justify-between sticky top-0 bg-white z-10">
              <div className="flex items-center gap-3">
                {step === "checkout" ? (
                  <button
                    type="button"
                    className="h-8 w-8 rounded-full hover:bg-neutral-100 inline-flex items-center justify-center text-neutral-700"
                    aria-label="Back"
                    onClick={() => {
                      if (openMode === "topup") {
                        setOpen(false);
                        try {
                          onClose?.();
                        } catch {
                          // ignore
                        }
                        return;
                      }
                      setStep("plans");
                      setError("");
                      setBuyingKey("");
                      setPayState("idle");
                    }}
                  >
                    ←
                  </button>
                ) : null}
                <div className="flex items-center gap-2">
                  <div className="font-semibold">{step === "checkout" ? "Оплата" : "Пакети уроків"}</div>
                  {step === "checkout" ? (
                    <div className="flex items-center gap-2 rounded-xl border border-neutral-200 bg-white px-2 py-1">
                      <div className="h-6 w-6 overflow-hidden rounded-lg ring-1 ring-neutral-200 bg-white text-neutral-700 flex items-center justify-center text-[10px] font-semibold">
                        {tutorImage ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img src={tutorImage} alt="" className="h-full w-full object-cover" />
                        ) : (
                          String(tutorName || "").slice(0, 2).toUpperCase()
                        )}
                      </div>
                      <div className="max-w-[160px] truncate text-xs font-semibold text-neutral-900">{tutorName}</div>
                    </div>
                  ) : null}
                </div>
              </div>
              <button
                type="button"
                className="h-8 w-8 rounded-full hover:bg-neutral-100 inline-flex items-center justify-center text-neutral-700"
                aria-label="Close"
                onClick={() => {
                  setOpen(false);
                  try {
                    onClose?.();
                  } catch {
                    // ignore
                  }
                }}
              >
                ✕
              </button>
            </div>

            <div className="px-5 py-4 overflow-y-auto overscroll-contain min-h-0 flex-1">
              {step === "plans" ? (
                <>
                  <div className="text-sm text-neutral-600">
                    Оберіть кількість уроків. Ціни вказані за стандартний 50–60 хв урок.
                  </div>

                  <div className="mt-4 space-y-3">
                    {options.map((opt) => {
                      const key = String(opt.lessons);
                      const busy = buyingKey === key;
                      const perLessonWithFee = Math.round(opt.total / Math.max(1, opt.lessons));

                      return (
                        <div key={opt.lessons} className="w-full rounded-2xl border border-neutral-200 px-4 py-4 bg-white">
                          <div className="flex items-start justify-between gap-4">
                            <div className="min-w-0">
                              <div className="text-lg font-semibold">{opt.lessons} уроків</div>
                              <div className="mt-1 text-sm text-neutral-600">
                                {opt.lessons} уроків · <span className="font-semibold text-neutral-900">{opt.total} ₴</span>
                              </div>
                              {recommendedLessons && recommendedLessons === opt.lessons ? (
                                <div className="mt-1 text-xs font-semibold text-pink-600">Рекомендовано</div>
                              ) : null}
                              <div className="mt-1 text-xs text-neutral-500">{perLessonWithFee} ₴/урок (з комісією)</div>
                              <div className="mt-1 text-xs text-neutral-500">Комісія 2% · {opt.fee} ₴</div>
                              <div className="mt-1 text-xs text-neutral-500">для занять з {tutorName}</div>
                            </div>

                            <div className="flex flex-col items-end gap-2 flex-shrink-0">
                              <button
                                type="button"
                                disabled={busy}
                                onClick={() => startCheckout(opt)}
                                className={
                                  !busy
                                    ? "inline-flex h-10 items-center justify-center rounded-xl bg-black px-4 text-sm font-semibold text-white hover:bg-neutral-800"
                                    : "inline-flex h-10 items-center justify-center rounded-xl bg-neutral-200 px-4 text-sm font-semibold text-neutral-500"
                                }
                              >
                                Купити
                              </button>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </>
              ) : selected ? (
                <>
                  {payState === "success" ? (
                    <>
                      <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-4">
                        <div className="flex items-start gap-3">
                          <div className="h-10 w-10 rounded-2xl bg-emerald-600 text-white flex items-center justify-center font-semibold">✓</div>
                          <div className="min-w-0">
                            <div className="text-sm font-semibold text-emerald-900">Оплата успішна</div>
                            <div className="mt-1 text-sm text-emerald-900/80">{selected.lessons} урок(и) додано для занять з {tutorName}.</div>
                            <div className="mt-1 text-xs text-emerald-900/70">Тепер можна одразу перейти до графіку та запланувати уроки.</div>
                          </div>
                        </div>
                      </div>

                      <button
                        type="button"
                        onClick={goScheduleNow}
                        className="mt-4 w-full h-11 rounded-xl bg-black px-5 text-sm font-semibold text-white hover:bg-neutral-800"
                      >
                        Запланувати зараз
                      </button>
                      <button
                        type="button"
                        onClick={goScheduleLater}
                        className="mt-2 w-full h-11 rounded-xl border border-neutral-200 bg-white px-5 text-sm font-semibold text-neutral-900 hover:bg-neutral-50"
                      >
                        Запланувати пізніше
                      </button>
                    </>
                  ) : (
                    <>
                  <div className="rounded-2xl border border-neutral-200 bg-white p-4">
                    <button
                      type="button"
                      className="w-full flex items-center justify-between"
                      onClick={() => setPlanOpen((v) => !v)}
                    >
                      <div className="text-sm font-semibold text-neutral-900">Ваш план підписки</div>
                      <div className="text-neutral-500">{planOpen ? "▴" : "▾"}</div>
                    </button>

                    <div className="mt-3 text-lg font-semibold text-neutral-900">
                      {selected.lessons} уроків
                    </div>
                    <div className="mt-1 text-sm text-neutral-600">
                      Приблизно {Math.max(1, Math.round(Number(selected.lessons || 0) / 4))} урок(и) на тиждень • всього {selected.lessons} уроків за {selected.total} ₴.
                    </div>

                    {planOpen ? (
                      <div className="mt-4 space-y-3">
                        <div className="flex items-start gap-3">
                          <div className="h-8 w-8 rounded-full bg-neutral-100 flex items-center justify-center text-neutral-700">📅</div>
                          <div className="text-sm text-neutral-900">Заплануйте уроки на будь-який час протягом 4 тижнів.</div>
                        </div>
                        <div className="flex items-start gap-3">
                          <div className="h-8 w-8 rounded-full bg-neutral-100 flex items-center justify-center text-neutral-700">🎓</div>
                          <div className="text-sm text-neutral-900">Змініть репетитора/-ку безкоштовно в будь-який момент.</div>
                        </div>
                        <div className="flex items-start gap-3">
                          <div className="h-8 w-8 rounded-full bg-neutral-100 flex items-center justify-center text-neutral-700">⛔</div>
                          <div className="text-sm text-neutral-900">Скасовуйте свій план у будь-який час.</div>
                        </div>
                        <div className="flex items-start gap-3">
                          <div className="h-8 w-8 rounded-full bg-neutral-100 flex items-center justify-center text-neutral-700">🕒</div>
                          <div className="text-sm text-neutral-900">Змінюйте тривалість уроків у будь-який час.</div>
                        </div>
                      </div>
                    ) : null}
                  </div>

                  <div className="rounded-2xl border border-neutral-200 bg-white p-4">
                    <div className="text-sm text-neutral-600">Ваше замовлення</div>
                    <div className="mt-2 text-base font-semibold text-neutral-900">{selected.lessons} уроків</div>
                    <div className="mt-1 text-sm text-neutral-600">з {tutorName}</div>

                    <div className="mt-4 space-y-2 text-sm">
                      <div className="flex items-center justify-between">
                        <div className="text-neutral-600">Підсумок</div>
                        <div className="font-semibold text-neutral-900">{selected.subtotal} ₴</div>
                      </div>
                      <div className="flex items-center justify-between">
                        <div className="text-neutral-600">Комісія</div>
                        <div className="font-semibold text-neutral-900">{selected.fee} ₴</div>
                      </div>
                      <div className="pt-2 border-t border-neutral-200 flex items-center justify-between">
                        <div className="text-neutral-900 font-semibold">Всього</div>
                        <div className="text-neutral-900 font-semibold">{selected.total} ₴</div>
                      </div>
                    </div>
                  </div>

                  <div className="mt-4 rounded-2xl border border-neutral-200 bg-white p-4">
                    <div className="text-sm text-neutral-600">Спосіб оплати</div>
                    <div className="mt-3 space-y-2">
                      {(["Apple Pay", "Нова платіжна карта", "PayPal", "Google Pay"] as const).map((m) => (
                        <label key={m} className="flex items-center gap-3 rounded-xl border border-neutral-200 px-3 py-2 hover:bg-neutral-50 cursor-pointer">
                          <input type="radio" name="pm" checked={paymentMethod === m} onChange={() => setPaymentMethod(m)} />
                          <span className="text-sm text-neutral-900">{m}</span>
                        </label>
                      ))}
                    </div>
                  </div>

                  <button
                    type="button"
                    disabled={payState === "processing"}
                    onClick={confirmAndPay}
                    className={
                      payState !== "processing"
                        ? "mt-4 w-full h-11 rounded-xl bg-black px-5 text-sm font-semibold text-white hover:bg-neutral-800"
                        : "mt-4 w-full h-11 rounded-xl bg-neutral-200 px-5 text-sm font-semibold text-neutral-500"
                    }
                  >
                    {payState === "processing" ? "Опрацьовуємо…" : "Оплатити"}
                  </button>
                    </>
                  )}
                </>
              ) : null}

              {error ? (
                <div className="mt-4 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-900">
                  {error}
                </div>
              ) : null}

              <div className="mt-4 text-xs text-neutral-500">
                Після вибору пакета ви зможете запланувати уроки.
              </div>
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}
