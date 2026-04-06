"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import ChatPanel from "@/components/ChatPanel";

export type ChatListItem = {
  id: string;
  title: string;
  avatarUrl?: string | null;
  preview: string;
  time: string;
  status?: string;
};

function initials(name: string) {
  const s = (name || "").trim();
  if (!s) return "?";
  const parts = s.split(/\s+/).filter(Boolean);
  const first = parts[0]?.[0] || "";
  const second = parts.length > 1 ? parts[1]?.[0] || "" : "";
  const out = (first + second).toUpperCase();
  return out || "?";
}

export default function ChatSplitView({
  locale,
  items,
}: {
  locale: string;
  items: ChatListItem[];
}) {
  const router = useRouter();
  const sp = useSearchParams();

  const [isDesktop, setIsDesktop] = useState(() => {
    if (typeof window === "undefined") return false;
    return window.innerWidth >= 900;
  });
  useEffect(() => {
    function update() {
      setIsDesktop(window.innerWidth >= 900);
    }
    update();
    window.addEventListener("resize", update);
    return () => window.removeEventListener("resize", update);
  }, []);

  const initialSelected = useMemo(() => {
    const fromUrl = sp?.get("chat") || "";
    if (fromUrl && items.some((i) => i.id === fromUrl)) return fromUrl;
    return items[0]?.id || null;
  }, [items, sp]);

  const [selectedId, setSelectedId] = useState<string | null>(initialSelected);

  function select(id: string) {
    setSelectedId(id);
    const url = `/${locale}/chat?chat=${encodeURIComponent(id)}`;
    router.replace(url);
  }

  return (
    <div
      className={
        "grid gap-0 border rounded-xl bg-white overflow-hidden " +
        (isDesktop ? "grid-cols-[360px_1fr]" : "grid-cols-1")
      }
    >
      {/* Left: list */}
      <aside className="border-r bg-white">
        {items.length === 0 ? (
          <div className="p-4 text-sm text-neutral-600">Поки що немає діалогів.</div>
        ) : (
          <div className="divide-y">
            {items.map((it) => {
              const active = it.id === selectedId;
              const href = `/${locale}/chat/${encodeURIComponent(it.id)}`;
              return (
                <Link
                  key={it.id}
                  prefetch={false}
                  href={href}
                  onClick={(e) => {
                    if (isDesktop) {
                      e.preventDefault();
                      select(it.id);
                    }
                  }}
                  className={
                    "block px-4 py-3 hover:bg-neutral-50 " +
                    (active ? "bg-neutral-50" : "")
                  }
                >
                  <div className="flex items-center gap-3">
                    {it.avatarUrl ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={it.avatarUrl}
                        alt={it.title}
                        className="h-10 w-10 rounded-full object-cover bg-neutral-200 flex-shrink-0"
                      />
                    ) : (
                      <div className="h-10 w-10 rounded-full bg-neutral-200 flex-shrink-0 flex items-center justify-center text-xs font-medium text-neutral-700">
                        {initials(it.title)}
                      </div>
                    )}
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center justify-between gap-2">
                        <div className="font-medium truncate">{it.title}</div>
                        <div className="text-[11px] text-neutral-500 flex-shrink-0">{it.time}</div>
                      </div>
                      <div className="text-sm text-neutral-600 truncate">{it.preview}</div>
                      {it.status ? (
                        <div className="text-[11px] text-neutral-400 mt-0.5">Status: {it.status}</div>
                      ) : null}
                    </div>
                  </div>
                </Link>
              );
            })}
          </div>
        )}
      </aside>

      {/* Right: thread */}
      <section className={(isDesktop ? "flex" : "hidden") + " flex-col h-[calc(100vh-140px)] bg-neutral-50"}>
        {selectedId ? (
          <ChatPanel bookingId={selectedId} />
        ) : (
          <div className="h-full flex items-center justify-center text-sm text-neutral-500">Оберіть чат</div>
        )}
      </section>
    </div>
  );
}
