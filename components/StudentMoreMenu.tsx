"use client";

import Link from "next/link";
import { useEffect, useId, useMemo, useRef, useState } from "react";

function MenuIcon({ children }: { children: React.ReactNode }) {
  return (
    <span className="inline-flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-lg bg-neutral-100 text-neutral-700">
      <span className="h-4 w-4" aria-hidden="true">
        {children}
      </span>
    </span>
  );
}

function IconMessage() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M21 15a4 4 0 0 1-4 4H8l-5 3V7a4 4 0 0 1 4-4h10a4 4 0 0 1 4 4z" />
    </svg>
  );
}

function IconShare() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M4 12v7a1 1 0 0 0 1 1h14a1 1 0 0 0 1-1v-7" />
      <path d="M12 3v13" />
      <path d="M7 8l5-5 5 5" />
    </svg>
  );
}

function IconLesson() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M4 4h16v16H4z" />
      <path d="M8 8h8" />
      <path d="M8 12h8" />
      <path d="M8 16h5" />
    </svg>
  );
}

export default function StudentMoreMenu({
  locale,
  bookingId,
  studentId,
  isArchived,
}: {
  locale: string;
  bookingId: string;
  studentId: string;
  isArchived: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [pos, setPos] = useState<{ left: number; top: number } | null>(null);
  const rootRef = useRef<HTMLDivElement>(null);
  const btnRef = useRef<HTMLButtonElement>(null);
  const rid = useId();

  const items = useMemo(() => {
    const bid = encodeURIComponent(String(bookingId));
    const loc = encodeURIComponent(String(locale));
    const lessonHref = `/${loc}/lesson/${bid}`;
    const chatHref = `/${loc}/chat/${bid}`;

    return [
      {
        label: "Увійти в клас",
        type: "disabled" as const,
        icon: (
          <MenuIcon>
            <IconLesson />
          </MenuIcon>
        ),
      },
      {
        type: "link" as const,
        href: chatHref,
        label: "Написати",
        icon: (
          <MenuIcon>
            <IconMessage />
          </MenuIcon>
        ),
      },
      {
        type: "link" as const,
        href: lessonHref,
        label: "Залишити відгук",
        icon: (
          <MenuIcon>
            <IconLesson />
          </MenuIcon>
        ),
      },
      {
        type: "button" as const,
        label: "Поділитися",
        icon: (
          <MenuIcon>
            <IconShare />
          </MenuIcon>
        ),
        onClick: () => {
          const url = `${window.location.origin}/${locale}/lesson/${encodeURIComponent(String(bookingId))}`;
          (async () => {
            try {
              if (navigator.share) {
                await navigator.share({ url });
                return;
              }
            } catch {
              // ignore
            }
            try {
              await navigator.clipboard.writeText(url);
            } catch {
              // ignore
            }
          })();
        },
      },
      {
        type: "button" as const,
        label: isArchived ? "Повернути з архіву" : "Архівувати",
        icon: (
          <MenuIcon>
            <IconLesson />
          </MenuIcon>
        ),
        onClick: () => {
          const sid = String(studentId || "");
          if (!sid) return;
          (async () => {
            try {
              const res = await fetch("/api/tutor/students/archive", {
                method: "POST",
                headers: { "content-type": "application/json" },
                body: JSON.stringify({ studentId: sid, action: isArchived ? "unarchive" : "archive" }),
              });
              if (!res.ok) {
                const data = await res.json().catch(() => null);
                const base = String(data?.error || data?.message || `HTTP ${res.status}`);
                const details = data?.details ? `\n\n${String(data.details)}` : "";
                const msg = `${base}${details}`;
                try {
                  window.alert(msg);
                } catch {
                  // ignore
                }
                return;
              }
            } catch {
              // ignore
              return;
            }
            try {
              window.location.reload();
            } catch {
              try {
                window.location.href = window.location.href;
              } catch {
                // ignore
              }
            }
          })();
        },
      },
      {
        type: "disabled" as const,
        label: "Змінити ціну (скоро)",
        icon: (
          <MenuIcon>
            <IconLesson />
          </MenuIcon>
        ),
      },
      {
        type: "disabled" as const,
        label: "Перейменувати (скоро)",
        icon: (
          <MenuIcon>
            <IconLesson />
          </MenuIcon>
        ),
      },
    ];
  }, [bookingId, isArchived, locale, studentId]);

  useEffect(() => {
    const onGlobalOpen = (e: Event) => {
      const ev = e as CustomEvent<{ id: string }>;
      if (ev?.detail?.id && ev.detail.id !== rid) setOpen(false);
    };
    window.addEventListener("student-more-menu-open", onGlobalOpen as any);
    return () => window.removeEventListener("student-more-menu-open", onGlobalOpen as any);
  }, [rid]);

  useEffect(() => {
    if (!open) return;

    const updatePos = () => {
      const el = btnRef.current;
      if (!el) return;
      const r = el.getBoundingClientRect();
      const width = 256;
      const margin = 8;
      const maxH = Math.min(Math.floor(window.innerHeight * 0.7), 420);
      const left = Math.max(margin, Math.min(r.right - width, window.innerWidth - width - margin));
      const preferredTop = r.bottom + 8;
      const openUp = preferredTop + maxH > window.innerHeight - margin && r.top - 8 - maxH >= margin;
      const top = openUp ? Math.max(margin, r.top - 8 - maxH) : Math.min(preferredTop, window.innerHeight - margin);
      setPos({ left, top });
    };

    updatePos();
    window.addEventListener("resize", updatePos);
    window.addEventListener("scroll", updatePos, true);

    const onScrollGesture = (e: Event) => {
      const root = rootRef.current;
      if (!root) return;
      const t = (e as any).target as Node | null;
      if (t && root.contains(t)) {
        setOpen(false);
        setPos(null);
      }
    };

    window.addEventListener("wheel", onScrollGesture as any, { capture: true, passive: true } as any);
    window.addEventListener("touchmove", onScrollGesture as any, { capture: true, passive: true } as any);

    const onDown = (e: MouseEvent | TouchEvent) => {
      const root = rootRef.current;
      if (!root) return;
      const t = e.target as Node | null;
      if (t && root.contains(t)) return;
      setOpen(false);
      setPos(null);
    };

    document.addEventListener("mousedown", onDown, { capture: true });
    document.addEventListener("touchstart", onDown, { capture: true });
    return () => {
      window.removeEventListener("resize", updatePos);
      window.removeEventListener("scroll", updatePos, true);
      window.removeEventListener("wheel", onScrollGesture as any, { capture: true } as any);
      window.removeEventListener("touchmove", onScrollGesture as any, { capture: true } as any);
      document.removeEventListener("mousedown", onDown, { capture: true } as any);
      document.removeEventListener("touchstart", onDown, { capture: true } as any);
    };
  }, [open]);

  return (
    <div ref={rootRef} className="relative">
      <button
        ref={btnRef}
        type="button"
        className="inline-flex h-10 w-10 items-center justify-center rounded-full text-neutral-700 hover:bg-neutral-100 transition"
        aria-label="Меню"
        onClick={(e) => {
          e.preventDefault();
          e.stopPropagation();
          const next = !open;
          if (next) {
            window.dispatchEvent(new CustomEvent("student-more-menu-open", { detail: { id: rid } }));
          }
          setOpen(next);
          if (!next) setPos(null);
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
        <div
          className="fixed w-64 max-h-[70vh] rounded-2xl border border-neutral-200 bg-white shadow-xl overflow-hidden overflow-y-auto z-[9999]"
          style={{ left: pos?.left ?? 0, top: pos?.top ?? 0 }}
        >
          {items.map((it: any, idx) => {
            const rowBase = "flex items-center gap-3 px-4 py-3 text-sm";
            const withDivider = idx < items.length - 1 ? " border-b border-neutral-100" : "";
            if (it.type === "link") {
              return (
                <Link
                  key={`${it.label}:${idx}`}
                  href={it.href}
                  className={`${rowBase}${withDivider} hover:bg-neutral-50`}
                  onClick={(e) => {
                    e.stopPropagation();
                    setOpen(false);
                    setPos(null);
                  }}
                >
                  {it.icon}
                  <span className="min-w-0 truncate">{it.label}</span>
                </Link>
              );
            }
            if (it.type === "disabled") {
              return (
                <div
                  key={`${it.label}:${idx}`}
                  className={`${rowBase}${withDivider} text-neutral-500 opacity-60 cursor-not-allowed`}
                >
                  {it.icon}
                  <span className="min-w-0 truncate">{it.label}</span>
                </div>
              );
            }
            return (
              <button
                key={`${it.label}:${idx}`}
                type="button"
                className={`w-full text-left ${rowBase}${withDivider} hover:bg-neutral-50`}
                onClick={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  it.onClick?.();
                  setOpen(false);
                  setPos(null);
                }}
              >
                {it.icon}
                <span className="min-w-0 truncate">{it.label}</span>
              </button>
            );
          })}
        </div>
      ) : null}
    </div>
  );
}
