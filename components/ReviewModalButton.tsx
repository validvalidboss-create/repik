"use client";

import { useEffect, useState } from "react";
import { Check, Star, X } from "lucide-react";
import ReviewForm from "@/components/ReviewForm";

export default function ReviewModalButton({
  bookingId,
  buttonText = "Оцінити",
  initialRated = false,
}: {
  bookingId: string;
  buttonText?: string;
  initialRated?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [rated, setRated] = useState(Boolean(initialRated));
  const [toastOpen, setToastOpen] = useState(false);

  useEffect(() => {
    if (!toastOpen) return;
    const t = window.setTimeout(() => setToastOpen(false), 2500);
    return () => window.clearTimeout(t);
  }, [toastOpen]);

  return (
    <>
      {rated ? (
        <button
          type="button"
          disabled
          className="inline-flex h-10 items-center gap-2 rounded-xl border border-neutral-200 bg-neutral-50 px-4 text-sm font-semibold text-neutral-700 cursor-not-allowed"
        >
          <Check className="h-4 w-4" />
          Оцінено
        </button>
      ) : (
        <button
          type="button"
          onClick={() => setOpen(true)}
          className="inline-flex h-10 items-center gap-2 rounded-xl border border-neutral-200 bg-white px-4 text-sm font-semibold text-neutral-900 hover:bg-neutral-50"
        >
          <Star className="h-4 w-4" />
          {buttonText}
        </button>
      )}

      {open ? (
        <div
          className="fixed inset-0 z-[10000] flex items-center justify-center bg-black/40 px-4"
          onMouseDown={(e) => {
            if (e.target === e.currentTarget) setOpen(false);
          }}
        >
          <div
            className="relative w-full max-w-md rounded-2xl bg-white shadow-2xl border border-neutral-200 p-4"
            onMouseDown={(e) => e.stopPropagation()}
          >
            <button
              type="button"
              className="absolute right-3 top-3 inline-flex h-9 w-9 items-center justify-center rounded-full text-neutral-700 hover:bg-neutral-100"
              aria-label="Close"
              onClick={() => setOpen(false)}
            >
              <X className="h-5 w-5" />
            </button>

            <ReviewForm
              bookingId={bookingId}
              onSubmitted={() => {
                setOpen(false);
                setRated(true);
                setToastOpen(true);
              }}
            />
          </div>
        </div>
      ) : null}

      {toastOpen ? (
        <div className="fixed inset-x-0 bottom-6 z-[10001] flex items-center justify-center px-4">
          <div className="rounded-2xl border border-neutral-200 bg-white px-4 py-3 text-sm font-semibold text-neutral-900 shadow-lg">
            Дякуємо за відгук
          </div>
        </div>
      ) : null}
    </>
  );
}
