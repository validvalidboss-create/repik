"use client";

import * as React from "react";

export default function BookScheduleModalButton({
  locale,
  tutorDbId,
  href,
  label,
  className,
}: {
  locale: string;
  tutorDbId: string;
  href: string;
  label: string;
  className: string;
}) {
  const [open, setOpen] = React.useState(false);
  const [hasBalance, setHasBalance] = React.useState(false);
  const [balanceLoaded, setBalanceLoaded] = React.useState(false);

  React.useEffect(() => {
    if (balanceLoaded) return;
    let mounted = true;
    (async () => {
      try {
        const cached = typeof window !== "undefined" ? window.sessionStorage?.getItem("hasLessonBalance") : null;
        if (cached === "1" || cached === "0") {
          if (mounted) {
            setHasBalance(cached === "1");
            setBalanceLoaded(true);
          }
          return;
        }
        const res = await fetch("/api/lesson-balance", { cache: "no-store" });
        const json = await res.json().catch(() => null);
        const list = Array.isArray(json?.byTutor) ? json.byTutor : [];
        const any = list.some((x: any) => Math.max(0, Math.floor(Number(x?.credits ?? 0) || 0)) > 0);
        try {
          if (typeof window !== "undefined") window.sessionStorage?.setItem("hasLessonBalance", any ? "1" : "0");
        } catch {
          // ignore
        }
        if (mounted) {
          setHasBalance(any);
          setBalanceLoaded(true);
        }
      } catch {
        if (mounted) {
          setHasBalance(false);
          setBalanceLoaded(true);
        }
      }
    })();
    return () => {
      mounted = false;
    };
  }, [balanceLoaded]);

  React.useEffect(() => {
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

  return (
    <>
      <a
        href={href}
        className={className}
        onClick={(e) => {
          e.preventDefault();
          if (hasBalance && tutorDbId) {
            setOpen(true);
            return;
          }
          if (typeof window !== "undefined") window.location.href = href;
        }}
      >
        {label}
      </a>

      {open ? (
        <div
          className="fixed inset-0 z-[10000] flex items-center justify-center bg-black/40 p-4"
          role="dialog"
          aria-modal="true"
          onMouseDown={(e) => {
            if (e.target === e.currentTarget) setOpen(false);
          }}
        >
          <div className="w-full max-w-3xl rounded-3xl bg-white shadow-2xl border border-neutral-200 overflow-hidden">
            <div className="relative flex items-center justify-end px-4 py-3 border-b border-neutral-200">
              <button
                type="button"
                className="inline-flex h-10 w-10 items-center justify-center rounded-full hover:bg-neutral-100 text-neutral-800"
                onClick={() => setOpen(false)}
                aria-label="Close"
              >
                ✕
              </button>
            </div>
            <div className="h-[78vh] bg-white">
              <iframe
                title="booking"
                src={`/${locale}/book/${encodeURIComponent(String(tutorDbId || ""))}?embed=1`}
                className="h-full w-full"
              />
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}
