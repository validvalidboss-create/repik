"use client";

import { useEffect, useMemo, useRef, useState } from "react";

type BoardEvent = {
  seq: number;
  bookingId: string;
  clientId: string;
  type: "stroke" | "text" | "clear";
  createdAt: number;
  payload: any;
};

type Tool = "pen" | "eraser" | "text";

export default function Whiteboard({
  bookingId,
  open,
  onClose,
}: {
  bookingId: string;
  open: boolean;
  onClose: () => void;
}) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const wrapRef = useRef<HTMLDivElement | null>(null);

  const [tool, setTool] = useState<Tool>("pen");
  const [color, setColor] = useState<string>("#22c55e");
  const [size, setSize] = useState<number>(3);
  const [since, setSince] = useState<number>(0);

  const clientId = useMemo(() => {
    return `c_${Math.random().toString(16).slice(2)}_${Date.now()}`;
  }, []);

  const drawingRef = useRef<{ active: boolean; lastX: number; lastY: number }>(
    { active: false, lastX: 0, lastY: 0 }
  );

  const queueRef = useRef<any[]>([]);

  function getCtx() {
    const c = canvasRef.current;
    if (!c) return null;
    return c.getContext("2d");
  }

  function resizeCanvas() {
    const c = canvasRef.current;
    const w = wrapRef.current;
    if (!c || !w) return;
    const rect = w.getBoundingClientRect();
    const dpr = Math.max(1, Math.floor(window.devicePixelRatio || 1));
    const nextW = Math.max(1, Math.floor(rect.width));
    const nextH = Math.max(1, Math.floor(rect.height));

    if (c.width === nextW * dpr && c.height === nextH * dpr) return;

    const prev = document.createElement("canvas");
    prev.width = c.width;
    prev.height = c.height;
    const prevCtx = prev.getContext("2d");
    if (prevCtx) prevCtx.drawImage(c, 0, 0);

    c.width = nextW * dpr;
    c.height = nextH * dpr;
    c.style.width = `${nextW}px`;
    c.style.height = `${nextH}px`;

    const ctx = c.getContext("2d");
    if (ctx) {
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.drawImage(prev, 0, 0, prev.width / dpr, prev.height / dpr);
    }
  }

  function applyEvent(ev: BoardEvent) {
    const ctx = getCtx();
    if (!ctx) return;

    if (ev.type === "clear") {
      const c = canvasRef.current;
      if (!c) return;
      ctx.clearRect(0, 0, c.width, c.height);
      return;
    }

    if (ev.type === "text") {
      const x = Number(ev.payload?.x || 0);
      const y = Number(ev.payload?.y || 0);
      const text = String(ev.payload?.text || "");
      const color = String(ev.payload?.color || "#ffffff");
      ctx.save();
      ctx.fillStyle = color;
      ctx.font = "16px ui-sans-serif, system-ui";
      ctx.fillText(text, x, y);
      ctx.restore();
      return;
    }

    if (ev.type === "stroke") {
      const pts: { x: number; y: number }[] = Array.isArray(ev.payload?.points)
        ? ev.payload.points
        : [];
      if (pts.length < 2) return;
      const color = String(ev.payload?.color || "#22c55e");
      const size = Number(ev.payload?.size || 3);
      const mode = String(ev.payload?.mode || "pen");

      ctx.save();
      ctx.lineJoin = "round";
      ctx.lineCap = "round";
      ctx.lineWidth = size;
      if (mode === "eraser") {
        ctx.globalCompositeOperation = "destination-out";
        ctx.strokeStyle = "rgba(0,0,0,1)";
      } else {
        ctx.globalCompositeOperation = "source-over";
        ctx.strokeStyle = color;
      }

      ctx.beginPath();
      ctx.moveTo(pts[0].x, pts[0].y);
      for (let i = 1; i < pts.length; i++) ctx.lineTo(pts[i].x, pts[i].y);
      ctx.stroke();
      ctx.restore();
      return;
    }
  }

  async function flushQueue() {
    if (!queueRef.current.length) return;
    const batch = queueRef.current.splice(0, queueRef.current.length);
    try {
      await fetch(`/api/whiteboard/${bookingId}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ clientId, events: batch }),
      });
    } catch {
      // ignore
    }
  }

  useEffect(() => {
    if (!open) return;
    resizeCanvas();
    const onResize = () => resizeCanvas();
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, [open]);

  useEffect(() => {
    if (!open) return;
    let alive = true;

    const tick = async () => {
      try {
        const res = await fetch(`/api/whiteboard/${bookingId}?since=${since}`, { cache: "no-store" });
        const data = await res.json();
        if (!alive) return;
        const events: BoardEvent[] = Array.isArray(data?.events) ? data.events : [];
        for (const ev of events) {
          if (ev.clientId === clientId) continue;
          applyEvent(ev);
          setSince((s) => Math.max(s, Number(ev.seq) || s));
        }
      } catch {
        // ignore
      }
    };

    const id = window.setInterval(tick, 300);
    tick();

    return () => {
      alive = false;
      window.clearInterval(id);
    };
  }, [open, bookingId, since, clientId]);

  useEffect(() => {
    if (!open) return;
    const id = window.setInterval(() => void flushQueue(), 250);
    return () => window.clearInterval(id);
  }, [open, bookingId]);

  if (!open) return null;

  const onPointerDown = async (e: React.PointerEvent) => {
    if (e.button !== 0) return;
    const rect = (e.currentTarget as HTMLCanvasElement).getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;

    if (tool === "text") {
      const text = window.prompt("Текст:");
      if (!text) return;
      const ev = { type: "text", payload: { x, y, text, color } };
      queueRef.current.push(ev);
      applyEvent({
        seq: -1,
        bookingId,
        clientId,
        type: "text",
        createdAt: Date.now(),
        payload: ev.payload,
      } as any);
      return;
    }

    drawingRef.current = { active: true, lastX: x, lastY: y };
    (e.currentTarget as HTMLCanvasElement).setPointerCapture(e.pointerId);
    queueRef.current.push({
      type: "stroke",
      payload: { mode: tool === "eraser" ? "eraser" : "pen", color, size, points: [{ x, y }] },
    });
  };

  const onPointerMove = (e: React.PointerEvent) => {
    if (!drawingRef.current.active) return;
    const rect = (e.currentTarget as HTMLCanvasElement).getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;

    const last = queueRef.current[queueRef.current.length - 1];
    if (!last || last.type !== "stroke") return;
    last.payload.points.push({ x, y });

    applyEvent({
      seq: -1,
      bookingId,
      clientId,
      type: "stroke",
      createdAt: Date.now(),
      payload: {
        mode: last.payload.mode,
        color: last.payload.color,
        size: last.payload.size,
        points: [
          { x: drawingRef.current.lastX, y: drawingRef.current.lastY },
          { x, y },
        ],
      },
    } as any);

    drawingRef.current.lastX = x;
    drawingRef.current.lastY = y;
  };

  const onPointerUp = () => {
    drawingRef.current.active = false;
  };

  const clear = () => {
    queueRef.current.push({ type: "clear", payload: {} });
    applyEvent({
      seq: -1,
      bookingId,
      clientId,
      type: "clear",
      createdAt: Date.now(),
      payload: {},
    } as any);
  };

  return (
    <div className="absolute inset-0 z-[9998] pointer-events-auto">
      <div
        className="absolute inset-0 bg-black/30"
        onPointerDown={(e) => {
          e.stopPropagation();
        }}
      />

      <div
        className="absolute left-4 top-4 z-[10000] flex items-center gap-2 rounded-xl border border-white/10 bg-black/60 px-3 py-2 text-xs text-white backdrop-blur"
        onPointerDown={(e) => e.stopPropagation()}
      >
        <button
          type="button"
          onClick={() => setTool("pen")}
          className={tool === "pen" ? "px-2 py-1 rounded bg-white/15" : "px-2 py-1 rounded bg-white/5"}
        >
          Pen
        </button>
        <button
          type="button"
          onClick={() => setTool("eraser")}
          className={tool === "eraser" ? "px-2 py-1 rounded bg-white/15" : "px-2 py-1 rounded bg-white/5"}
        >
          Erase
        </button>
        <button
          type="button"
          onClick={() => setTool("text")}
          className={tool === "text" ? "px-2 py-1 rounded bg-white/15" : "px-2 py-1 rounded bg-white/5"}
        >
          Text
        </button>

        <input
          type="color"
          value={color}
          onChange={(e) => setColor(e.target.value)}
          className="h-6 w-6 rounded overflow-hidden bg-transparent"
        />

        <input
          type="range"
          min={1}
          max={10}
          value={size}
          onChange={(e) => setSize(Number(e.target.value) || 3)}
        />

        <button type="button" onClick={clear} className="px-2 py-1 rounded bg-white/5">
          Clear
        </button>
        <button type="button" onClick={onClose} className="px-2 py-1 rounded bg-white/5">
          Close
        </button>
      </div>

      <div
        ref={wrapRef}
        className="absolute inset-0"
        onPointerDown={(e) => {
          e.stopPropagation();
        }}
      >
        <canvas
          ref={canvasRef}
          className="absolute inset-0"
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={onPointerUp}
          onPointerCancel={onPointerUp}
        />
      </div>
    </div>
  );
}
