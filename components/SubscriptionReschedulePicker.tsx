"use client";

import { useEffect, useId, useMemo, useRef, useState } from "react";

export default function SubscriptionReschedulePicker({
  locale,
  tutorId,
  bookings,
  buttonText = "Перенести урок",
}: {
  locale: string;
  tutorId: string;
  bookings: Array<{ id: string; startsAt: string }>;
  buttonText?: string;
}) {
  const [open, setOpen] = useState(false);
  const [pos, setPos] = useState<{ left: number; top: number } | null>(null);
  const rootRef = useRef<HTMLDivElement>(null);
  const btnRef = useRef<HTMLButtonElement>(null);
  const rid = useId();

  const items = useMemo(() => {
    const fmt = new Intl.DateTimeFormat(locale === "uk" ? "uk-UA" : locale === "ru" ? "ru-RU" : "en-US", {
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
    });
    return (Array.isArray(bookings) ? bookings : [])
      .filter((b) => b && b.id && b.startsAt)
      .slice(0, 10)
      .map((b) => ({
        id: String(b.id),
        label: fmt.format(new Date(String(b.startsAt))),
      }));
  }, [bookings, locale]);

  function close() {
    setOpen(false);
    setPos(null);
  }

  useEffect(() => {
    const onGlobalOpen = (e: Event) => {
      const ev = e as CustomEvent<{ id: string }>;
      if (ev?.detail?.id && ev.detail.id !== rid) setOpen(false);
    };
    window.addEventListener("subscription-reschedule-open", onGlobalOpen as any);
    return () => window.removeEventListener("subscription-reschedule-open", onGlobalOpen as any);
  }, [rid]);

  useEffect(() => {
    if (!open) return;

    const updatePos = () => {
      const el = btnRef.current;
      if (!el) return;
      const r = el.getBoundingClientRect();
      const width = 320;
      const margin = 8;
      const maxH = Math.min(Math.floor(window.innerHeight * 0.6), 360);
      const left = Math.max(margin, Math.min(r.left, window.innerWidth - width - margin));
      const preferredTop = r.bottom + 8;
      const openUp = preferredTop + maxH > window.innerHeight - margin && r.top - 8 - maxH >= margin;
      const top = openUp ? Math.max(margin, r.top - 8 - maxH) : Math.min(preferredTop, window.innerHeight - margin);
      setPos({ left, top });
    };

    updatePos();
    window.addEventListener("resize", updatePos);
    window.addEventListener("scroll", updatePos, true);

    const onDown = (e: MouseEvent | TouchEvent) => {
      const root = rootRef.current;
      if (!root) return;
      const t = e.target as Node | null;
      if (t && root.contains(t)) return;
      close();
    };

    document.addEventListener("mousedown", onDown, { capture: true });
    document.addEventListener("touchstart", onDown, { capture: true });

    return () => {
      window.removeEventListener("resize", updatePos);
      window.removeEventListener("scroll", updatePos, true);
      document.removeEventListener("mousedown", onDown, { capture: true } as any);
      document.removeEventListener("touchstart", onDown, { capture: true } as any);
    };
  }, [open]);

  return (
    <div ref={rootRef} className="relative">
      <button
        ref={btnRef}
        type="button"
        className="inline-flex h-12 w-full items-center justify-center rounded-xl bg-neutral-900 px-5 text-sm font-semibold text-white hover:bg-neutral-800"
        onClick={(e) => {
          e.preventDefault();
          e.stopPropagation();
          const next = !open;
          if (next) {
            window.dispatchEvent(new CustomEvent("subscription-reschedule-open", { detail: { id: rid } }));
          }
          setOpen(next);
          if (!next) setPos(null);
        }}
      >
        {buttonText}
      </button>

      {open ? (
        <div
          className="fixed w-80 max-h-[60vh] rounded-2xl border border-neutral-200 bg-white shadow-xl overflow-hidden overflow-y-auto z-[9999]"
          style={{ left: pos?.left ?? 0, top: pos?.top ?? 0 }}
        >
          <div className="px-4 py-3 text-xs font-semibold text-neutral-500 border-b border-neutral-100">Оберіть урок для переносу</div>
          {items.map((it, idx) => (
            <button
              key={`${it.id}:${idx}`}
              type="button"
              className="w-full text-left px-4 py-3 text-sm hover:bg-neutral-50 border-b border-neutral-100"
              onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
                close();
                const href = `/${locale}/schedule/${encodeURIComponent(String(tutorId))}?reschedule=${encodeURIComponent(it.id)}`;
                window.location.href = href;
              }}
            >
              {it.label}
            </button>
          ))}
          {items.length === 0 ? <div className="px-4 py-3 text-sm text-neutral-600">Немає уроків для переносу</div> : null}
        </div>
      ) : null}
    </div>
  );
}
