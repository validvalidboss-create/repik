"use client";

import { useMemo, useState, type CSSProperties } from "react";

export default function CollapsibleText({
  text,
  collapsedLines = 5,
  className = "",
  buttonClassName = "",
  moreLabel = "Докладніше",
  lessLabel = "Згорнути",
}: {
  text: string;
  collapsedLines?: number;
  className?: string;
  buttonClassName?: string;
  moreLabel?: string;
  lessLabel?: string;
}) {
  const [open, setOpen] = useState(false);
  const hasText = String(text || "").trim().length > 0;

  const clampLines = useMemo(() => {
    return Math.max(1, Math.min(30, Math.round(collapsedLines)));
  }, [collapsedLines]);

  if (!hasText) {
    return <div className={className}>—</div>;
  }

  return (
    <div>
      <p
        className={`${className}`.trim()}
        style={
          open
            ? undefined
            : ({
                display: "-webkit-box",
                WebkitBoxOrient: "vertical",
                WebkitLineClamp: clampLines,
                overflow: "hidden",
              } as CSSProperties)
        }
      >
        {text}
      </p>
      <div className="mt-3">
        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          className={
            buttonClassName ||
            "border rounded-md px-3 py-1.5 text-sm hover:bg-neutral-50"
          }
        >
          {open ? lessLabel : moreLabel}
        </button>
      </div>
    </div>
  );
}
