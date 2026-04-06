"use client";
import { type ChangeEvent, useEffect, useMemo, useRef, useState } from "react";
import { useSession } from "next-auth/react";

type Message = {
  id: string;
  bookingId: string;
  senderId: string;
  content: string;
  attachments?: string[];
  createdAt: string;
};

function isImageUrl(u: string) {
  const s = String(u || "").toLowerCase();
  return (
    s.startsWith("data:image/") ||
    s.endsWith(".png") ||
    s.endsWith(".jpg") ||
    s.endsWith(".jpeg") ||
    s.endsWith(".gif") ||
    s.endsWith(".webp") ||
    s.includes("image")
  );
}

function isAudioUrl(u: string) {
  const s = String(u || "").toLowerCase();
  return (
    s.startsWith("data:audio/") ||
    s.endsWith(".webm") ||
    s.endsWith(".mp3") ||
    s.endsWith(".wav") ||
    s.endsWith(".ogg") ||
    s.includes("audio")
  );
}

function fmtDur(sec: number) {
  const s = Math.max(0, Math.floor(Number(sec) || 0));
  const mm = String(Math.floor(s / 60)).padStart(2, "0");
  const ss = String(s % 60).padStart(2, "0");
  return `${mm}:${ss}`;
}

function hashSeed(s: string) {
  let h = 2166136261;
  const str = String(s || "");
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

function mulberry32(a: number) {
  return function () {
    let t = (a += 0x6d2b79f5);
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function VoiceMessage({ url, mine, theme }: { url: string; mine: boolean; theme: "light" | "dark" }) {
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const [playing, setPlaying] = useState(false);
  const [cur, setCur] = useState(0);
  const [dur, setDur] = useState(0);

  useEffect(() => {
    const a = audioRef.current;
    if (!a) return;
    const onTime = () => setCur(a.currentTime || 0);
    const onMeta = () => setDur(a.duration || 0);
    const onEnd = () => {
      setPlaying(false);
      setCur(0);
    };
    a.addEventListener("timeupdate", onTime);
    a.addEventListener("loadedmetadata", onMeta);
    a.addEventListener("ended", onEnd);
    return () => {
      a.removeEventListener("timeupdate", onTime);
      a.removeEventListener("loadedmetadata", onMeta);
      a.removeEventListener("ended", onEnd);
    };
  }, [url]);

  const pct = dur > 0 ? Math.max(0, Math.min(100, (cur / dur) * 100)) : 0;
  const bars = useMemo(() => {
    const rnd = mulberry32(hashSeed(url));
    const n = 28;
    const out: number[] = [];
    for (let i = 0; i < n; i++) {
      // keep it visually pleasant (not too spiky)
      out.push(0.25 + rnd() * 0.75);
    }
    return out;
  }, [url]);

  return (
    <div
      className={
        "w-full max-w-[300px] rounded-2xl px-3 py-2 " +
        (mine ? "bg-neutral-900" : theme === "dark" ? "bg-white/10" : "bg-white")
      }
      style={mine ? undefined : theme === "dark" ? undefined : ({ boxShadow: "0 1px 0 rgba(0,0,0,0.04)" } as any)}
    >
      <audio ref={audioRef} src={url} preload="metadata" />
      <div className="flex items-center gap-3">
        <button
          type="button"
          className={
            "h-9 w-9 rounded-full inline-flex items-center justify-center flex-shrink-0 " +
            (mine ? "bg-white/20 text-white" : theme === "dark" ? "bg-white/10 text-white" : "bg-neutral-900 text-white")
          }
          onClick={() => {
            const a = audioRef.current;
            if (!a) return;
            if (a.paused) {
              a.play().then(
                () => setPlaying(true),
                () => void 0
              );
            } else {
              a.pause();
              setPlaying(false);
            }
          }}
          aria-label={playing ? "Pause" : "Play"}
          title={playing ? "Pause" : "Play"}
        >
          <span className="text-sm" aria-hidden="true">
            {playing ? "⏸" : "▶"}
          </span>
        </button>

        <div className="flex-1 min-w-0">
          <div
            className={"h-9 px-1 rounded-xl flex items-center gap-[2px] cursor-pointer " + (mine ? "bg-white/15" : theme === "dark" ? "bg-white/5" : "bg-neutral-50")}
            onClick={(e) => {
              const a = audioRef.current;
              if (!a || !dur) return;
              const rect = (e.currentTarget as HTMLDivElement).getBoundingClientRect();
              const x = Math.max(0, Math.min(rect.width, e.clientX - rect.left));
              a.currentTime = (x / rect.width) * dur;
            }}
          >
            {bars.map((v, i) => {
              const played = i / Math.max(1, bars.length - 1) <= pct / 100;
              const h = 6 + Math.round(v * 18);
              const base = mine
                ? played
                  ? "bg-white"
                  : "bg-white/60"
                : theme === "dark"
                  ? played
                    ? "bg-white"
                    : "bg-white/50"
                  : played
                    ? "bg-neutral-900"
                    : "bg-neutral-400";
              return <span key={i} className={"w-[2px] rounded-full " + base} style={{ height: `${h}px` }} />;
            })}
          </div>
        </div>

        <div className={"text-[11px] tabular-nums flex-shrink-0 " + (mine ? "text-white/80" : theme === "dark" ? "text-white/60" : "text-neutral-500")}>
          {fmtDur(dur || 0)}
        </div>
      </div>
    </div>
  );
}

export default function ChatPanel({
  bookingId,
  fullscreen = false,
  theme = "light",
}: {
  bookingId: string;
  fullscreen?: boolean;
  theme?: "light" | "dark";
}) {
  const { data: session } = useSession();
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string>("");
  const [sending, setSending] = useState(false);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [pickerTab, setPickerTab] = useState<"emoji" | "stickers">("emoji");
  const [freqEmoji, setFreqEmoji] = useState<string[]>([]);
  const [recState, setRecState] = useState<"idle" | "starting" | "recording" | "sending">("idle");
  const [recSec, setRecSec] = useState<number>(0);
  const [recLocked, setRecLocked] = useState<boolean>(false);
  const [recError, setRecError] = useState<string>("");
  const composerHeight = 76;
  const rootRef = useRef<HTMLDivElement>(null);
  const listRef = useRef<HTMLDivElement>(null);
  const bottomRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const inputWrapRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const lastPointerDownInsideRef = useRef<boolean>(false);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const recChunksRef = useRef<BlobPart[]>([]);
  const micBtnRef = useRef<HTMLButtonElement | null>(null);
  const recStartXRef = useRef<number>(0);
  const recStartYRef = useRef<number>(0);
  const recCanceledRef = useRef<boolean>(false);
  const recStartedAtRef = useRef<number>(0);
  const ignoreNextClickRef = useRef<boolean>(false);
  const recStartTokenRef = useRef<number>(0);
  const recCancelStartRef = useRef<boolean>(false);

  const allEmoji = useMemo(
    () => [
      "😀",
      "😁",
      "😂",
      "🤣",
      "😊",
      "😉",
      "😍",
      "😘",
      "😎",
      "😅",
      "😭",
      "😡",
      "🤔",
      "👍",
      "🙏",
      "👏",
      "🔥",
      "❤️",
      "💪",
      "✅",
      "❌",
      "🎉",
      "📝",
      "📌",
      "📚",
      "⚡",
      "🥳",
      "🤝",
      "😴",
      "😇",
      "🤍",
      "💙",
      "💛",
      "💚",
      "💜",
      "🧠",
      "🎯",
      "📷",
    ],
    []
  );

  const allStickers = useMemo(
    () => [
      "👍",
      "👏",
      "🔥",
      "❤️",
      "😂",
      "😭",
      "😎",
      "🎉",
      "✅",
      "❌",
      "📌",
      "📚",
      "💯",
      "🙏",
      "🤝",
      "⚡",
    ],
    []
  );

  function normalizeMessages(arr: Message[]) {
    const byId = new Map<string, Message>();
    for (const m of Array.isArray(arr) ? arr : []) {
      if (!m?.id) continue;
      byId.set(String(m.id), m);
    }
    const out = Array.from(byId.values());
    out.sort((a, b) => {
      const ta = new Date(a.createdAt).getTime();
      const tb = new Date(b.createdAt).getTime();
      if (!Number.isNaN(ta) && !Number.isNaN(tb)) return ta - tb;
      return String(a.id).localeCompare(String(b.id));
    });
    return out;
  }

  const myId = useMemo(() => {
    const u = session?.user as any;
    return u?.id ? String(u.id) : undefined;
  }, [session?.user]);

  async function load() {
    setLoadError("");
    try {
      const res = await fetch(`/api/messages?bookingId=${encodeURIComponent(String(bookingId || ""))}`, { cache: "no-store" });
      const data = await res
        .json()
        .catch(() => ({ ok: false, error: "Invalid server response" } as any));
      if (res.ok) {
        setMessages(normalizeMessages((data as any)?.messages || []));
      } else {
        const msg = String((data as any)?.error || `HTTP ${res.status}`);
        setLoadError(msg);
      }
    } catch (e: any) {
      setLoadError(String(e?.message || "Failed to load messages"));
    } finally {
      setLoading(false);
    }
  }

  async function sendAttachments(urls: string[], fallbackText?: string) {
    const at = (Array.isArray(urls) ? urls : []).map((x) => String(x || "").trim()).filter(Boolean);
    if (at.length === 0) return;
    setSending(true);

    const optimisticId = `optimistic_${Date.now()}`;
    const optimistic: Message | null = myId
      ? {
          id: optimisticId,
          bookingId,
          senderId: myId,
          content: String(fallbackText || ""),
          attachments: at,
          createdAt: new Date().toISOString(),
        }
      : null;
    if (optimistic) setMessages((arr) => normalizeMessages([...arr, optimistic]));

    try {
      const res = await fetch(`/api/messages`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ bookingId, content: String(fallbackText || ""), attachments: at }),
      });
      const data = await res.json();
      if (res.ok) {
        setMessages((arr) => {
          const next = arr.filter((m) => m.id !== optimisticId);
          return normalizeMessages([...next, data.message]);
        });
        load();
      }
    } finally {
      setSending(false);
    }
  }

  async function requestPresign(file: File) {
    const res = await fetch("/api/uploads/presign", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ filename: file.name, type: file.type || "application/octet-stream" }),
    });
    const data = await res.json().catch(() => null);
    if (!res.ok) throw new Error(data?.error || "Failed to presign");
    return data as any;
  }

  async function handlePickFile(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    setPickerOpen(false);
    try {
      const presign = await requestPresign(file);
      if (presign?.disabled) {
        const dataUrl = await new Promise<string>((resolve, reject) => {
          const fr = new FileReader();
          fr.onerror = () => reject(new Error("read failed"));
          fr.onload = () => resolve(String(fr.result || ""));
          fr.readAsDataURL(file);
        });
        if (dataUrl) {
          await sendAttachments([dataUrl], file.name);
          return;
        }
      }
    } catch {
      // ignore
    }
  }

  async function startRecord() {
    if (recState !== "idle") return;
    setPickerOpen(false);
    setRecError("");
    recCancelStartRef.current = false;
    const token = Date.now();
    recStartTokenRef.current = token;
    setRecState("starting");
    try {
      if (typeof navigator === "undefined" || !navigator.mediaDevices?.getUserMedia) {
        throw new Error("Мікрофон недоступний у цьому браузері");
      }
      if (typeof MediaRecorder === "undefined") {
        throw new Error("Запис голосових не підтримується у цьому браузері");
      }

      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      if (recCancelStartRef.current || recStartTokenRef.current !== token) {
        try {
          for (const t of stream.getTracks()) t.stop();
        } catch {
          // ignore
        }
        setRecState("idle");
        return;
      }

      const pickMime = () => {
        const candidates = [
          "audio/webm;codecs=opus",
          "audio/webm",
          "audio/mp4",
          "audio/mpeg",
        ];
        for (const c of candidates) {
          try {
            if ((MediaRecorder as any).isTypeSupported?.(c)) return c;
          } catch {
            // ignore
          }
        }
        return "";
      };

      const mimeType = pickMime();
      const mr = mimeType ? new MediaRecorder(stream, { mimeType }) : new MediaRecorder(stream);
      mediaRecorderRef.current = mr;
      recChunksRef.current = [];
      recCanceledRef.current = false;
      recStartedAtRef.current = Date.now();
      setRecSec(0);
      setRecLocked(false);

      mr.ondataavailable = (ev) => {
        if (ev.data && ev.data.size > 0) recChunksRef.current.push(ev.data);
      };

      mr.onstop = async () => {
        try {
          for (const t of stream.getTracks()) t.stop();
        } catch {
          // ignore
        }

        const chunks = recChunksRef.current;
        recChunksRef.current = [];
        mediaRecorderRef.current = null;

        if (recCanceledRef.current) {
          setRecState("idle");
          return;
        }

        setRecState("sending");
        try {
          const blob = new Blob(chunks, { type: mr.mimeType || "audio/webm" });
          if (!blob || blob.size < 200) {
            setRecState("idle");
            return;
          }
          const file = new File([blob], `voice_${Date.now()}.webm`, { type: blob.type || "audio/webm" });
          const presign = await requestPresign(file);
          if (presign?.disabled) {
            try {
              const fd = new FormData();
              fd.append("file", file);
              const up = await fetch("/api/uploads/local", {
                method: "POST",
                body: fd,
              });
              const upData = await up.json().catch(() => null);
              if (!up.ok || !upData?.url) {
                throw new Error(upData?.error || "Не вдалося завантажити голосове");
              }
              await sendAttachments([String(upData.url)], "");
            } catch (e) {
              const msg = e instanceof Error ? e.message : "Не вдалося надіслати голосове";
              setRecError(msg);
            }
          }
        } catch (e) {
          const msg = e instanceof Error ? e.message : "Не вдалося надіслати голосове";
          setRecError(msg);
        } finally {
          setRecState("idle");
        }
      };

      // timeslice ensures we get dataavailable chunks even for shorter recordings
      mr.start(250);
      setRecState("recording");
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Не вдалося запустити запис";
      setRecError(msg);
      setRecState("idle");
    }
  }

  function stopRecord() {
    if (recState === "starting") {
      recCancelStartRef.current = true;
      setRecState("idle");
      return;
    }
    if (recState !== "recording") return;
    try {
      mediaRecorderRef.current?.stop();
    } catch {
      // ignore
    }
  }

  function cancelRecord() {
    if (recState === "starting") {
      recCancelStartRef.current = true;
      setRecState("idle");
      return;
    }
    if (recState !== "recording") return;
    recCanceledRef.current = true;
    stopRecord();
  }

  const canSend = input.trim().length > 0;

  async function sendSticker(st: string) {
    const val = String(st || "");
    if (!val) return;
    setPickerOpen(false);
    setInput((v) => v + val);
    try {
      inputRef.current?.focus();
    } catch {
      // ignore
    }
  }

  async function sendTextNow(text: string) {
    const t = String(text || "").trim();
    if (!t) return;
    setSending(true);

    const optimisticId = `optimistic_${Date.now()}`;
    const optimistic: Message | null = myId
      ? {
          id: optimisticId,
          bookingId,
          senderId: myId,
          content: t,
          attachments: [],
          createdAt: new Date().toISOString(),
        }
      : null;
    if (optimistic) setMessages((arr) => normalizeMessages([...arr, optimistic]));

    try {
      const res = await fetch(`/api/messages`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ bookingId, content: t, attachments: [] }),
      });
      const data = await res.json();
      if (res.ok) {
        setMessages((arr) => {
          const next = arr.filter((m) => m.id !== optimisticId);
          return normalizeMessages([...next, data.message]);
        });
        load();
      }
    } finally {
      setSending(false);
    }
  }

  async function finishLockedRecordingSend() {
    if (recState !== "recording") return;
    if (!recLocked) return;
    recCanceledRef.current = false;
    stopRecord();
  }

  async function finishRecordingSend() {
    if (recState !== "recording") return;
    recCanceledRef.current = false;
    stopRecord();
  }

  useEffect(() => {
    if (recState !== "recording") return;
    const t = window.setInterval(() => {
      const started = recStartedAtRef.current;
      if (!started) return;
      setRecSec(Math.max(0, Math.floor((Date.now() - started) / 1000)));
    }, 250);
    return () => window.clearInterval(t);
  }, [recState]);

  useEffect(() => {
    load();
    const t = setInterval(load, 4000);
    return () => clearInterval(t);
  }, [bookingId]);

  useEffect(() => {
    try {
      const raw = window.localStorage.getItem("repetitir:chat:freq_emoji");
      const arr = raw ? (JSON.parse(raw) as any) : [];
      if (Array.isArray(arr)) {
        setFreqEmoji(arr.map((x) => String(x || "")).filter(Boolean).slice(0, 16));
      }
    } catch {
      // ignore
    }
  }, []);

  function pushFreqEmoji(em: string) {
    const e = String(em || "");
    if (!e) return;
    setFreqEmoji((prev) => {
      const next = [e, ...prev.filter((x) => x !== e)].slice(0, 16);
      try {
        window.localStorage.setItem("repetitir:chat:freq_emoji", JSON.stringify(next));
      } catch {
        // ignore
      }
      return next;
    });
  }

  useEffect(() => {
    // autoscroll
    bottomRef.current?.scrollIntoView({ block: "end" });
  }, [messages.length]);

  useEffect(() => {
    const t = window.setTimeout(() => {
      try {
        inputRef.current?.focus();
      } catch {
        // ignore
      }
    }, 50);
    return () => window.clearTimeout(t);
  }, [bookingId, theme, fullscreen]);

  useEffect(() => {
    const onDocPointerDown = (e: PointerEvent) => {
      const root = rootRef.current;
      if (!root) {
        lastPointerDownInsideRef.current = false;
        return;
      }
      const target = e.target as any;
      lastPointerDownInsideRef.current = !!(target && root.contains(target));
    };
    document.addEventListener("pointerdown", onDocPointerDown, true);
    return () => {
      document.removeEventListener("pointerdown", onDocPointerDown, true);
    };
  }, []);

  function formatTime(iso: string) {
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return "";
    return d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
  }

  async function send() {
    const text = input.trim();
    if (!text) return;
    setSending(true);

    const optimisticId = `optimistic_${Date.now()}`;
    const optimistic: Message | null = myId
      ? {
          id: optimisticId,
          bookingId,
          senderId: myId,
          content: text,
          createdAt: new Date().toISOString(),
        }
      : null;
    if (optimistic) {
      setMessages((arr) => normalizeMessages([...arr, optimistic]));
      setInput("");
    }

    try {
      const res = await fetch(`/api/messages`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ bookingId, content: text, attachments: [] }),
      });
      const data = await res.json();
      if (res.ok) {
        setInput("");
        setMessages((arr) => {
          const next = arr.filter((m) => m.id !== optimisticId);
          return normalizeMessages([...next, data.message]);
        });
        // sync list from server (ordering, createdAt, etc)
        load();
      }
    } finally {
      setSending(false);
    }
  }

  return (
    <div
      ref={rootRef}
      className={
        (theme === "dark"
          ? "border border-white/10 rounded-lg h-full flex flex-col bg-neutral-950 text-white overflow-hidden relative "
          : "border rounded-lg h-full flex flex-col bg-white overflow-hidden relative ") +
        (fullscreen ? "border-0 rounded-none" : "")
      }
      style={{ pointerEvents: "auto" }}
    >
      <div
        ref={listRef}
        className={
          (theme === "dark"
            ? "flex-1 min-h-0 overflow-y-auto p-3 space-y-2 bg-neutral-950 "
            : "flex-1 min-h-0 overflow-y-auto p-3 space-y-2 bg-neutral-50 ") +
          ""
        }
        style={{ touchAction: "pan-y", overscrollBehavior: "contain" } as any}
      >
        {loading ? (
          <div className={theme === "dark" ? "text-sm text-white/60" : "text-sm text-muted-foreground"}>Loading…</div>
        ) : loadError ? (
          <div className="space-y-2">
            <div className={theme === "dark" ? "text-sm text-red-200" : "text-sm text-red-700"}>
              {loadError}
            </div>
            <button
              type="button"
              onClick={() => {
                setLoading(true);
                void load();
              }}
              className={
                theme === "dark"
                  ? "inline-flex h-9 items-center rounded-xl bg-white/10 px-3 text-sm font-semibold text-white hover:bg-white/15"
                  : "inline-flex h-9 items-center rounded-xl border border-neutral-200 bg-white px-3 text-sm font-semibold text-neutral-900 hover:bg-neutral-50"
              }
            >
              Retry
            </button>
          </div>
        ) : messages.length === 0 ? (
          <div className={theme === "dark" ? "text-sm text-white/60" : "text-sm text-muted-foreground"}>No messages yet</div>
        ) : (
          messages.map((m) => {
            const mine = !!myId && m.senderId === myId;
            return (
              <div key={m.id} className={`flex ${mine ? "justify-end" : "justify-start"}`}>
                <div
                  className={
                    "max-w-[85%] rounded-2xl px-3 py-2 text-sm shadow-sm border " +
                    (mine
                      ? "bg-neutral-900 text-white border-neutral-900 rounded-br-md"
                      : theme === "dark"
                        ? "bg-white/5 text-white border-white/10 rounded-bl-md"
                        : "bg-white text-neutral-900 border-neutral-200 rounded-bl-md")
                  }
                >
                  {Array.isArray(m.attachments) && m.attachments.length > 0 ? (
                    <div className="space-y-2">
                      {m.attachments.map((u, idx) => {
                        const url = String(u || "").trim();
                        if (!url) return null;
                        return (
                          <div key={`${m.id}:att:${idx}`}>
                            {isImageUrl(url) ? (
                              // eslint-disable-next-line @next/next/no-img-element
                              <img src={url} alt="" className="max-h-64 w-auto rounded-xl border border-white/10" />
                            ) : isAudioUrl(url) ? (
                              <div className={"flex " + (mine ? "justify-end" : "justify-start")}>
                                <VoiceMessage url={url} mine={mine} theme={theme} />
                              </div>
                            ) : (
                              <a
                                href={url}
                                target="_blank"
                                rel="noreferrer"
                                className={mine ? "underline text-white" : theme === "dark" ? "underline text-white" : "underline text-neutral-900"}
                              >
                                {url}
                              </a>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  ) : null}

                  <div
                    className={
                      "whitespace-pre-wrap break-words " +
                      (mine ? "text-white" : theme === "dark" ? "text-white" : "text-neutral-900")
                    }
                    style={{ color: mine ? "#ffffff" : theme === "dark" ? "#ffffff" : "#111827" }}
                  >
                    {m.content}
                  </div>
                  <div className={`mt-1 text-[10px] ${mine ? "text-white/80" : "text-neutral-500"} text-right`}>
                    {formatTime(m.createdAt)}
                  </div>
                </div>
              </div>
            );
          })
        )}
        <div ref={bottomRef} />
      </div>

      <div
        className={
          (fullscreen
            ? theme === "dark"
              ? "fixed left-0 right-0 bottom-0 z-50 border-t border-white/10 bg-neutral-950"
              : "fixed left-0 right-0 bottom-0 z-50 border-t bg-white"
            : theme === "dark"
              ? "border-t border-white/10 bg-neutral-950"
              : "border-t bg-white") +
          " p-3 flex items-end gap-3 flex-shrink-0 overflow-visible"
        }
        style={fullscreen ? ({ paddingBottom: "calc(12px + env(safe-area-inset-bottom))" } as any) : undefined}
      >
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          className="hidden"
          onChange={handlePickFile}
        />

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            className={
              theme === "dark"
                ? "h-10 w-10 rounded-full border border-white/10 bg-white/5 text-white/80 hover:bg-white/10 inline-flex items-center justify-center"
                : "h-10 w-10 rounded-full border bg-white text-neutral-700 hover:bg-neutral-50 inline-flex items-center justify-center"
            }
            style={{ transform: "translateY(-10px)" } as any}
            aria-label="Фото"
            title="Фото"
          >
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="h-5 w-5" aria-hidden="true">
              <path d="M21.44 11.05 12.25 20.24a6 6 0 0 1-8.49-8.49l9.19-9.19a4 4 0 0 1 5.66 5.66l-9.19 9.19a2 2 0 1 1-2.83-2.83l8.48-8.48" />
            </svg>
          </button>

          <button
            type="button"
            onClick={() => {
              if (pickerOpen && pickerTab === "emoji") setPickerOpen(false);
              else setPickerOpen(true);
              setPickerTab("emoji");
            }}
            className={
              theme === "dark"
                ? "h-10 w-10 rounded-full border border-white/10 bg-white/5 text-white/80 hover:bg-white/10 inline-flex items-center justify-center"
                : "h-10 w-10 rounded-full border bg-white text-neutral-700 hover:bg-neutral-50 inline-flex items-center justify-center"
            }
            style={{ transform: "translateY(-10px)" } as any}
            aria-label="Emoji"
            title="Emoji"
          >
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="h-5 w-5" aria-hidden="true">
              <circle cx="12" cy="12" r="10" />
              <path d="M8 14s1.5 2 4 2 4-2 4-2" />
              <path d="M9 9h.01" />
              <path d="M15 9h.01" />
            </svg>
          </button>
        </div>

        {recError ? (
          <div className={"-mt-2 mb-2 text-xs " + (theme === "dark" ? "text-red-300" : "text-red-700")}>{recError}</div>
        ) : null}

        <div
          ref={inputWrapRef}
          className="relative w-full z-50"
          style={{ pointerEvents: "auto", minHeight: 48 }}
          onPointerDownCapture={(e) => {
            const target = e.target as any;
            const isTextarea = !!(target && (target === inputRef.current || target?.tagName === "TEXTAREA"));
            if (!isTextarea) return;
            if (recState === "recording" || recState === "starting") return;
            e.stopPropagation();
            const el = inputRef.current;
            if (!el) return;
            try {
              window.requestAnimationFrame(() => {
                try {
                  el.focus();
                } catch {
                  // ignore
                }
              });
            } catch {
              // ignore
            }
          }}
          onMouseDownCapture={(e) => {
            const target = e.target as any;
            const isTextarea = !!(target && (target === inputRef.current || target?.tagName === "TEXTAREA"));
            if (!isTextarea) return;
            if (recState === "recording" || recState === "starting") return;
            e.stopPropagation();
            const el = inputRef.current;
            if (!el) return;
            try {
              window.requestAnimationFrame(() => {
                try {
                  el.focus();
                } catch {
                  // ignore
                }
              });
            } catch {
              // ignore
            }
          }}
        >
          {recState === "recording" || recState === "starting" ? (
            <div
              className={
                "w-full h-12 rounded-2xl pl-4 pr-16 text-sm flex items-center justify-between " +
                (theme === "dark"
                  ? "border border-white/10 bg-white/5 text-white"
                  : "border border-neutral-200 bg-white text-neutral-900")
              }
            >
              <div className="flex items-center gap-3 min-w-0">
                <div className="flex items-center gap-2">
                  <span
                    className={
                      "inline-block h-2 w-2 rounded-full " +
                      (recState === "starting" ? "bg-red-500 animate-pulse" : recLocked ? "bg-red-500" : "bg-red-500 animate-pulse")
                    }
                    aria-hidden="true"
                  />
                  <div className="text-sm font-medium">{recState === "starting" ? "Запуск…" : "Запись…"}</div>
                </div>
                {recState === "recording" ? (
                  <div className={theme === "dark" ? "text-xs text-white/60" : "text-xs text-neutral-500"}>
                    {String(Math.floor(recSec / 60)).padStart(2, "0")}:{String(recSec % 60).padStart(2, "0")}
                  </div>
                ) : null}
                {recState === "recording" && !recLocked ? (
                  <div className={theme === "dark" ? "text-xs text-white/50 truncate" : "text-xs text-neutral-400 truncate"}>
                    Свайп влево — отмена
                  </div>
                ) : null}
              </div>
              <div className="flex items-center gap-2 flex-shrink-0">
                <button
                  type="button"
                  className={
                    theme === "dark"
                      ? "h-9 px-3 rounded-full border border-white/10 bg-white/5 text-white/80 hover:bg-white/10 text-xs"
                      : "h-9 px-3 rounded-full border bg-white text-neutral-700 hover:bg-neutral-50 text-xs"
                  }
                  onClick={() => {
                    setRecLocked(false);
                    cancelRecord();
                  }}
                >
                  Cancel
                </button>
                <button
                  type="button"
                  disabled={recState !== "recording"}
                  className={
                    "h-9 px-3 rounded-full text-xs text-white " +
                    (recState !== "recording" ? "bg-neutral-900/40 cursor-not-allowed" : "bg-neutral-900 hover:bg-neutral-800")
                  }
                  onClick={() => {
                    if (recLocked) void finishLockedRecordingSend();
                    else void finishRecordingSend();
                  }}
                >
                  Send
                </button>
              </div>
            </div>
          ) : (
            <textarea
              ref={inputRef}
              autoFocus
              tabIndex={0}
              className={
                theme === "dark"
                  ? "w-full border border-white/10 rounded-2xl pl-4 pr-16 py-3 text-sm resize-none h-12 max-h-[120px] leading-5 bg-white/5 text-white placeholder:text-white/40 focus:outline-none focus:ring-2 focus:ring-white/20"
                  : "w-full border rounded-2xl pl-4 pr-16 py-3 text-sm resize-none h-12 max-h-[120px] leading-5 bg-white text-neutral-900 placeholder:text-neutral-400 focus:outline-none focus:ring-2 focus:ring-neutral-900/20"
              }
              placeholder="Повідомлення…"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onPointerDown={(e) => {
                e.stopPropagation();
                try {
                  inputRef.current?.focus();
                } catch {
                  // ignore
                }
              }}
              onMouseDown={(e) => {
                e.stopPropagation();
                e.preventDefault();
                try {
                  inputRef.current?.focus();
                } catch {
                  // ignore
                }
              }}
              onTouchStart={(e) => {
                e.stopPropagation();
                try {
                  inputRef.current?.focus();
                } catch {
                  // ignore
                }
              }}
              onClick={(e) => {
                e.stopPropagation();
                try {
                  inputRef.current?.focus();
                } catch {
                  // ignore
                }
              }}
              onBlur={() => {
                if (!lastPointerDownInsideRef.current) return;
                const t = window.setTimeout(() => {
                  try {
                    inputRef.current?.focus();
                  } catch {
                    // ignore
                  }
                }, 0);
                window.setTimeout(() => window.clearTimeout(t), 0);
              }}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  send();
                }
              }}
              style={
                {
                  color: theme === "dark" ? "#ffffff" : "#111827",
                  WebkitTextFillColor: theme === "dark" ? "#ffffff" : "#111827",
                  caretColor: theme === "dark" ? "#ffffff" : "#111827",
                  pointerEvents: "auto",
                  userSelect: "text",
                  WebkitUserSelect: "text",
                  position: "relative",
                  zIndex: 1,
                  touchAction: "manipulation",
                } as any
              }
            />
          )}

          {canSend ? (
            <button
              type="button"
              data-chat-send="true"
              onClick={send}
              disabled={sending || !canSend}
              className="absolute right-2 bottom-3 z-50 h-9 w-9 rounded-full bg-neutral-900 text-white disabled:opacity-50 inline-flex items-center justify-center"
              aria-label="Надіслати"
              title="Надіслати"
              style={
                {
                  display: "inline-flex",
                  backgroundColor: "#111827",
                  color: "#ffffff",
                  alignItems: "center",
                  justifyContent: "center",
                } as any
              }
            >
              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="h-5 w-5" aria-hidden="true">
                <path d="M2.01 21L23 12 2.01 3 2 10l15 2-15 2z" />
              </svg>
            </button>
          ) : (
            <button
              ref={micBtnRef}
              type="button"
              className={
                "absolute right-2 bottom-3 z-50 h-9 w-9 rounded-full text-white inline-flex items-center justify-center " +
                (recState === "recording" || recState === "starting" ? "bg-red-600" : "bg-neutral-800")
              }
              aria-label={recState === "recording" || recState === "starting" ? "Запись" : "Голосовое"}
              title={recState === "recording" || recState === "starting" ? "Запись…" : "Голосовое"}
              onClick={(e) => {
                // desktop-friendly: click toggles start/stop
                e.preventDefault();
                e.stopPropagation();
                if (ignoreNextClickRef.current) {
                  ignoreNextClickRef.current = false;
                  return;
                }
                if (recState === "recording" || recState === "starting") {
                  if (recLocked) void finishLockedRecordingSend();
                  else stopRecord();
                  return;
                }
                recCanceledRef.current = false;
                setRecLocked(false);
                void startRecord();
              }}
              onPointerDown={(e) => {
                e.preventDefault();
                e.stopPropagation();
                // For mouse we use click-to-toggle; hold gestures only for touch/pen
                if ((e as any).pointerType === "mouse") return;
                ignoreNextClickRef.current = true;
                recStartXRef.current = e.clientX;
                recStartYRef.current = e.clientY;
                recCanceledRef.current = false;
                setRecLocked(false);
                try {
                  (e.currentTarget as any).setPointerCapture?.(e.pointerId);
                } catch {
                  // ignore
                }
                void startRecord();
              }}
              onPointerMove={(e) => {
                if (recState !== "recording") return;
                if ((e as any).pointerType === "mouse") return;
                if (!recLocked) {
                  const dy = e.clientY - recStartYRef.current;
                  if (dy < -60) {
                    setRecLocked(true);
                    return;
                  }
                }
                if (recLocked) return;
                const dx = e.clientX - recStartXRef.current;
                if (dx < -80) {
                  recCanceledRef.current = true;
                }
              }}
              onPointerUp={(e) => {
                e.preventDefault();
                e.stopPropagation();
                if (recState !== "recording") return;
                if ((e as any).pointerType === "mouse") return;
                if (recLocked) return;
                if (recCanceledRef.current) cancelRecord();
                else stopRecord();
              }}
              onPointerCancel={() => {
                if (recState !== "recording") return;
                cancelRecord();
              }}
            >
              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="h-5 w-5" aria-hidden="true">
                <path d="M12 14a3 3 0 0 0 3-3V5a3 3 0 0 0-6 0v6a3 3 0 0 0 3 3z" />
                <path d="M19 11a7 7 0 0 1-14 0" />
                <path d="M12 19v3" />
                <path d="M8 22h8" />
              </svg>
            </button>
          )}
        </div>
      </div>

      {pickerOpen ? (
        <div className="absolute inset-0 z-[80]" style={{ pointerEvents: "auto" }}>
          <button
            type="button"
            className="absolute inset-0 w-full h-full bg-transparent"
            onClick={() => setPickerOpen(false)}
            aria-label="Close picker"
            title="Close"
          />

          <div
            className={
              "absolute left-0 right-0 bottom-0 px-3 pb-3 " +
              (theme === "dark" ? "bg-neutral-900/90 border-t border-white/10" : "bg-white/95 border-t border-neutral-200")
            }
            style={{ paddingBottom: fullscreen ? "calc(env(safe-area-inset-bottom) + 12px)" : undefined } as any}
          >
            {recError ? (
              <div className={"mb-2 text-xs " + (theme === "dark" ? "text-red-300" : "text-red-700")}>{recError}</div>
            ) : null}
            <div
              ref={inputWrapRef}
              className={
                "relative rounded-2xl border p-2 " +
                (theme === "dark" ? "border-white/10 bg-white/5" : "border-neutral-200 bg-white")
              }
            >
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  className={
                    "h-8 px-3 rounded-full text-xs " +
                    (pickerTab === "emoji"
                      ? theme === "dark"
                        ? "bg-white/10 text-white"
                        : "bg-neutral-900 text-white"
                      : theme === "dark"
                        ? "text-white/70 hover:bg-white/5"
                        : "text-neutral-700 hover:bg-neutral-100")
                  }
                  onClick={() => setPickerTab("emoji")}
                >
                  Emoji
                </button>
                <button
                  type="button"
                  className={
                    "h-8 px-3 rounded-full text-xs " +
                    (pickerTab === "stickers"
                      ? theme === "dark"
                        ? "bg-white/10 text-white"
                        : "bg-neutral-900 text-white"
                      : theme === "dark"
                        ? "text-white/70 hover:bg-white/5"
                        : "text-neutral-700 hover:bg-neutral-100")
                  }
                  onClick={() => setPickerTab("stickers")}
                >
                  Stickers
                </button>
              </div>
              <button
                type="button"
                className={theme === "dark" ? "text-white/60 hover:text-white" : "text-neutral-500 hover:text-neutral-800"}
                onClick={() => setPickerOpen(false)}
                aria-label="Close"
                title="Close"
              >
                ✕
              </button>
            </div>

            <div className="h-[252px] overflow-y-auto p-3" style={{ touchAction: "pan-y", overscrollBehavior: "contain" } as any}>
              {pickerTab === "emoji" ? (
                <div className="space-y-3">
                  {freqEmoji.length > 0 ? (
                    <div>
                      <div className={theme === "dark" ? "text-[11px] text-white/50 mb-2" : "text-[11px] text-neutral-500 mb-2"}>
                        Часто используемые
                      </div>
                      <div className="grid grid-cols-8 gap-1.5">
                        {freqEmoji.map((em, idx) => (
                          <button
                            key={`${em}:${idx}`}
                            type="button"
                            className={
                              "h-8 w-8 rounded-xl text-xl transition-transform active:scale-110 " +
                              (theme === "dark" ? "hover:bg-white/10" : "hover:bg-neutral-100")
                            }
                            onClick={() => {
                              setInput((v) => v + em);
                              pushFreqEmoji(em);
                              try {
                                inputRef.current?.focus();
                              } catch {
                                // ignore
                              }
                            }}
                          >
                            {em}
                          </button>
                        ))}
                      </div>
                    </div>
                  ) : null}

                  <div>
                    <div className="grid grid-cols-8 gap-1.5">
                      {allEmoji.map((em, idx) => (
                        <button
                          key={`${em}:${idx}`}
                          type="button"
                          className={
                            "h-8 w-8 rounded-xl text-xl transition-transform active:scale-110 " +
                            (theme === "dark" ? "hover:bg-white/10" : "hover:bg-neutral-100")
                          }
                          onClick={() => {
                            setInput((v) => v + em);
                            pushFreqEmoji(em);
                            try {
                              inputRef.current?.focus();
                            } catch {
                              // ignore
                            }
                          }}
                        >
                          {em}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
              ) : (
                <div className="grid grid-cols-4 gap-2">
                  {allStickers.map((st, idx) => (
                    <button
                      key={`${st}:${idx}`}
                      type="button"
                      className={
                        "h-14 w-14 rounded-2xl text-3xl transition-transform active:scale-110 " +
                        (theme === "dark" ? "hover:bg-white/10" : "hover:bg-neutral-100")
                      }
                      onClick={() => void sendSticker(st)}
                    >
                      {st}
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
