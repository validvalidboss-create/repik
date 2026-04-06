"use client";

import Link from "next/link";
import { useEffect, useId, useMemo, useRef, useState } from "react";

export default function ThreadMoreMenu({
  locale,
  bookingId,
  tutorId,
  variant,
}: {
  locale: string;
  bookingId: string;
  tutorId: string | null;
  variant: "trial" | "post_lesson";
}) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const rid = useId();

  const items = useMemo(() => {
    if (variant === "post_lesson") {
      return [
        {
          href: tutorId ? `/${locale}/book/${encodeURIComponent(tutorId)}` : `/${locale}/tutors`,
          label: "Запланувати урок",
        },
        {
          href: `/${locale}/lesson/${encodeURIComponent(bookingId)}`,
          label: "Залишити відгук",
        },
      ];
    }
    return [
      {
        href: tutorId ? `/${locale}/book/${encodeURIComponent(tutorId)}` : `/${locale}/tutors`,
        label: "Забронювати пробний урок",
      },
    ];
  }, [bookingId, locale, tutorId, variant]);

  useEffect(() => {
    const onGlobalOpen = (e: Event) => {
      const ev = e as CustomEvent<{ id: string }>;
      if (ev?.detail?.id && ev.detail.id !== rid) setOpen(false);
    };
    window.addEventListener("thread-more-menu-open", onGlobalOpen as any);
    return () => window.removeEventListener("thread-more-menu-open", onGlobalOpen as any);
  }, [rid]);

  useEffect(() => {
    if (!open) return;

    const onDown = (e: MouseEvent | TouchEvent) => {
      const root = rootRef.current;
      if (!root) return;
      const t = e.target as Node | null;
      if (t && root.contains(t)) return;
      setOpen(false);
    };

    document.addEventListener("mousedown", onDown, { capture: true });
    document.addEventListener("touchstart", onDown, { capture: true });
    return () => {
      document.removeEventListener("mousedown", onDown, { capture: true } as any);
      document.removeEventListener("touchstart", onDown, { capture: true } as any);
    };
  }, [open]);

  return (
    <div ref={rootRef} className="relative">
      <button
        type="button"
        className="h-8 w-8 inline-flex items-center justify-center text-neutral-600 hover:text-neutral-800"
        aria-label="Меню"
        onClick={(e) => {
          e.preventDefault();
          e.stopPropagation();
          const next = !open;
          if (next) {
            window.dispatchEvent(new CustomEvent("thread-more-menu-open", { detail: { id: rid } }));
          }
          setOpen(next);
        }}
        onMouseDown={(e) => {
          e.preventDefault();
          e.stopPropagation();
        }}
      >
        <span className="text-[18px] leading-none" aria-hidden="true">
          ⋯
        </span>
      </button>

      {open ? (
        <div className="absolute right-0 mt-2 w-56 rounded-2xl border border-neutral-200 bg-white shadow-xl overflow-hidden z-40">
          {items.map((it) => (
            <Link
              key={it.href}
              href={it.href}
              className="block px-3 py-2.5 text-sm hover:bg-neutral-50"
              onClick={(e) => {
                e.stopPropagation();
                setOpen(false);
              }}
            >
              {it.label}
            </Link>
          ))}
        </div>
      ) : null}
    </div>
  );
}
