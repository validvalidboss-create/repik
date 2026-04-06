"use client";

import { useState } from "react";

export default function PayoutSupportCTA({
  locale,
  context,
}: {
  locale: string;
  context: string;
}) {
  const [open, setOpen] = useState(false);
  const [text, setText] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [fileUrl, setFileUrl] = useState<string>("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function uploadIfNeeded() {
    if (!file) return "";
    if (fileUrl) return fileUrl;
    const type = String(file.type || "").toLowerCase();
    if (!type.startsWith("image/")) throw new Error("Можна прикріпити лише зображення");
    const fd = new FormData();
    fd.append("file", file);
    const res = await fetch("/api/uploads/local", { method: "POST", body: fd });
    const data = await res.json().catch(() => null);
    if (!res.ok || !data?.url) throw new Error(String(data?.error || `HTTP ${res.status}`));
    const url = String(data.url);
    setFileUrl(url);
    return url;
  }

  async function submit() {
    const msg = text.trim();
    if (!msg) {
      setError("Опишіть проблему");
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const url = await uploadIfNeeded();
      const res = await fetch("/api/support/report", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ locale, message: msg, context, attachments: url ? [url] : [] }),
      });
      const data = await res.json().catch(() => null);
      if (!res.ok || !data?.ok || !data?.bookingId) {
        throw new Error(String(data?.error || `HTTP ${res.status}`));
      }
      window.location.href = `/${encodeURIComponent(locale)}/chat/${encodeURIComponent(String(data.bookingId))}`;
    } catch (e) {
      setError(e instanceof Error ? e.message : "Помилка відправки");
      setBusy(false);
    }
  }

  return (
    <>
      <button
        type="button"
        onClick={() => {
          setOpen(true);
          setError(null);
          setText("");
          setFile(null);
          setFileUrl("");
        }}
        className="text-sm font-semibold text-neutral-900 underline underline-offset-4 hover:text-neutral-700"
      >
        Проблема з виплатами?
      </button>

      {open ? (
        <div className="fixed inset-0 z-[100]">
          <button
            type="button"
            className="absolute inset-0 bg-black/40"
            onClick={() => {
              if (!busy) setOpen(false);
            }}
            aria-label="Close"
          />
          <div className="absolute left-1/2 top-1/2 w-[92vw] max-w-lg -translate-x-1/2 -translate-y-1/2 rounded-2xl border border-neutral-200 bg-white p-5 shadow-xl">
            <div className="text-lg font-semibold text-neutral-900">Опишіть проблему</div>
            <div className="mt-1 text-xs text-neutral-600">Ми відкриємо чат з адміністрацією та надішлемо ваше повідомлення.</div>

            <textarea
              value={text}
              onChange={(e) => setText(e.target.value)}
              rows={5}
              placeholder="Наприклад: не можу запросити виплату / сума на виплаті не змінюється / невірний баланс…"
              className="mt-3 w-full resize-none rounded-xl border border-neutral-200 bg-white px-3 py-2 text-sm text-neutral-900 placeholder:text-neutral-400 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
            />

            <div className="mt-3 flex flex-col sm:flex-row sm:items-center gap-2">
              <label className="inline-flex h-10 cursor-pointer items-center justify-center rounded-xl border border-neutral-200 bg-white px-4 text-sm font-semibold text-neutral-900 hover:bg-neutral-50">
                Прикріпити скрін
                <input
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={(e) => {
                    const f = e.target.files?.[0] || null;
                    e.target.value = "";
                    setFile(f);
                    setFileUrl("");
                  }}
                  disabled={busy}
                />
              </label>
              <div className="text-xs text-neutral-600">
                {file ? `Обрано: ${file.name}` : "Не обрано"}
              </div>
            </div>

            {error ? <div className="mt-2 text-sm text-red-700">{error}</div> : null}

            <div className="mt-4 flex items-center justify-end gap-2">
              <button
                type="button"
                disabled={busy}
                onClick={() => setOpen(false)}
                className="inline-flex h-10 items-center rounded-xl border border-neutral-200 bg-white px-4 text-sm font-semibold text-neutral-900 hover:bg-neutral-50 disabled:opacity-60"
              >
                Скасувати
              </button>
              <button
                type="button"
                disabled={busy}
                onClick={submit}
                className="inline-flex h-10 items-center rounded-xl bg-neutral-900 px-4 text-sm font-semibold text-white hover:bg-neutral-800 disabled:opacity-60"
              >
                Відправити
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}
