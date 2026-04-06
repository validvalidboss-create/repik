"use client";
import { useState } from "react";
import { Star } from "lucide-react";

export default function ReviewForm({
  bookingId,
  onSubmitted,
}: {
  bookingId: string;
  onSubmitted?: () => void;
}) {
  const [rating, setRating] = useState<number | null>(null);
  const [text, setText] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [step, setStep] = useState<"rating" | "comment" | "done">("rating");

  async function submit() {
    setSubmitting(true);
    setMessage(null);
    try {
      if (!(typeof rating === "number" && rating >= 1 && rating <= 5)) {
        throw new Error("rating required");
      }
      const res = await fetch("/api/reviews", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ bookingId, rating, text }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error || "Failed to submit review");
      setMessage("Review submitted");
      setStep("done");
      try {
        onSubmitted?.();
      } catch {
        // ignore
      }
    } catch (e) {
      setMessage((e as Error).message);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="border rounded-lg p-4 bg-white">
      {step === "done" ? (
        <div>
          <div className="font-medium">Дякуємо за оцінку!</div>
          {message ? <div className="mt-2 text-sm">{message}</div> : null}
        </div>
      ) : step === "rating" ? (
        <div>
          <div className="font-medium mb-1">Дякуємо за урок!</div>
          <div className="text-sm text-neutral-600 mb-3">Ти молодець. Оціни, як пройшов урок.</div>
          <div className="flex items-center gap-3 mb-2">
            <label className="text-sm">Оцінка</label>
            <div
              className="flex items-center gap-1"
              role="radiogroup"
              aria-label="Оцінка 1–5"
            >
              {[1, 2, 3, 4, 5].map((r) => {
                const selected = typeof rating === "number" ? rating : 0;
                const active = selected >= r;
                return (
                  <button
                    key={r}
                    type="button"
                    disabled={submitting}
                    onClick={() => setRating(r)}
                    className="inline-flex h-9 w-9 items-center justify-center rounded-md border border-neutral-200 bg-white hover:bg-neutral-50 disabled:opacity-50"
                    aria-checked={rating === r}
                    role="radio"
                    aria-label={`${r}`}
                  >
                    <Star className={`h-5 w-5 ${active ? "fill-amber-400 text-amber-400" : "text-neutral-300"}`} />
                  </button>
                );
              })}
            </div>
          </div>
          <div className="mt-3 flex items-center gap-2">
            <button
              type="button"
              onClick={() => setStep("comment")}
              disabled={submitting || !(typeof rating === "number" && rating >= 1 && rating <= 5)}
              className="px-4 py-2 bg-black text-white rounded text-sm disabled:opacity-50"
            >
              Далі
            </button>
            {message && <div className="text-sm">{message}</div>}
          </div>
        </div>
      ) : (
        <div>
          <div className="font-medium mb-2">Коментар (необов'язково)</div>
          <textarea
            className="w-full border rounded px-3 py-2 h-24 text-sm"
            placeholder="Ваш відгук"
            value={text}
            onChange={(e) => setText(e.target.value)}
          />
          <div className="mt-2 flex items-center gap-2">
            <button
              type="button"
              onClick={submit}
              disabled={submitting || !(typeof rating === "number" && rating >= 1 && rating <= 5)}
              className="px-4 py-2 bg-black text-white rounded text-sm disabled:opacity-50"
            >
              {submitting ? "Submitting..." : "Надіслати"}
            </button>
            <button
              type="button"
              onClick={() => {
                setText("");
                void submit();
              }}
              disabled={submitting || !(typeof rating === "number" && rating >= 1 && rating <= 5)}
              className="px-4 py-2 border rounded text-sm disabled:opacity-50"
            >
              Пропустити
            </button>
            {message && <div className="text-sm">{message}</div>}
          </div>
        </div>
      )}
    </div>
  );
}
