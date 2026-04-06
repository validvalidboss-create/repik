"use client";

import { useEffect, useId, useMemo, useRef, useState } from "react";

export default function TutorListingControls({
  locale,
  status,
}: {
  locale: string;
  status: "pending" | "active" | "rejected" | "needs_revision" | "paused" | "draft" | "none";
}) {
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState<null | "pause" | "deactivate" | "activate">(null);
  const rootRef = useRef<HTMLDivElement>(null);
  const rid = useId();

  const canPause = status === "active";
  const canDeactivate = status === "active" || status === "paused";
  const canActivate = status === "paused" || status === "draft";

  const items = useMemo(() => {
    const out: Array<{
      key: string;
      label: string;
      action: "pause" | "deactivate" | "schedule" | "directions";
      danger?: boolean;
      disabled?: boolean;
    }> = [];

    out.push({
      key: "schedule",
      label: "Змінити графік",
      action: "schedule",
      disabled: false,
    });

    out.push({
      key: "directions",
      label: "Змінити напрямки",
      action: "directions",
      disabled: false,
    });

    out.push({
      key: "pause",
      label: "Приостановити анкету",
      action: "pause",
      disabled: !canPause || !!busy,
    });

    out.push({
      key: "deactivate",
      label: "Деактивувати (видалити з пошуку)",
      action: "deactivate",
      danger: true,
      disabled: !canDeactivate || !!busy,
    });

    return out;
  }, [busy, canDeactivate, canPause]);

  useEffect(() => {
    const onGlobalOpen = (e: Event) => {
      const ev = e as CustomEvent<{ id: string }>;
      if (ev?.detail?.id && ev.detail.id !== rid) setOpen(false);
    };
    window.addEventListener("tutor-listing-menu-open", onGlobalOpen as any);
    return () => window.removeEventListener("tutor-listing-menu-open", onGlobalOpen as any);
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

  async function call(action: "pause" | "deactivate" | "activate") {
    if (busy) return;

    if (action === "pause") {
      const ok = window.confirm("Приостановити анкету? Вона зникне з пошуку, доки ви не активуєте її знову.");
      if (!ok) return;
    }

    if (action === "deactivate") {
      const ok = window.confirm("Деактивувати анкету (прибрати з пошуку)?");
      if (!ok) return;
    }

    setBusy(action);
    try {
      const res = await fetch("/api/teacher/listing-status", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data?.error || `HTTP ${res.status}`);
      }
      window.location.href = `/${locale}/profile`;
    } catch (e: any) {
      window.alert(e?.message || "Не вдалося оновити статус анкети");
    } finally {
      setBusy(null);
    }
  }

  return (
    <div className="flex items-center gap-2" ref={rootRef}>
      {canActivate ? (
        <button
          type="button"
          onClick={(e) => {
            e.preventDefault();
            e.stopPropagation();
            call("activate");
          }}
          disabled={!!busy}
          className="inline-flex items-center rounded-lg border border-neutral-300 bg-white px-3 py-1.5 text-xs font-medium text-neutral-900 hover:bg-neutral-50 disabled:opacity-60"
        >
          {busy === "activate" ? "…" : "Активувати анкету"}
        </button>
      ) : null}

      {(canPause || canDeactivate) ? (
        <div className="relative">
          <button
            type="button"
            className="inline-flex h-8 w-8 items-center justify-center rounded-full text-neutral-600 hover:bg-neutral-100"
            aria-label="Меню"
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
              const next = !open;
              if (next) {
                window.dispatchEvent(new CustomEvent("tutor-listing-menu-open", { detail: { id: rid } }));
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
            <div className="absolute right-0 mt-2 w-72 rounded-2xl border border-neutral-200 bg-white shadow-xl overflow-hidden z-40">
              {items.map((it, idx) => {
                const rowBase = "w-full text-left px-4 py-3 text-sm";
                const withDivider = idx < items.length - 1 ? " border-b border-neutral-100" : "";
                return (
                  <button
                    key={it.key}
                    type="button"
                    disabled={it.disabled}
                    className={`${rowBase}${withDivider} ${it.danger ? "text-red-700" : "text-neutral-900"} hover:bg-neutral-50 disabled:opacity-50`}
                    onClick={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                      setOpen(false);
                      if (it.action === "schedule") {
                        window.location.href = `/${locale}/teacher/schedule`;
                        return;
                      }
                      if (it.action === "directions") {
                        window.location.href = `/${locale}/teacher/directions`;
                        return;
                      }
                      call(it.action);
                    }}
                  >
                    {it.label}
                  </button>
                );
              })}
            </div>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
