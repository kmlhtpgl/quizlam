import type { ReactNode } from "react";
import clsx from "clsx";

export function Pill({
  children,
  tone = "neutral",
  className,
}: {
  children: ReactNode;
  tone?: "neutral" | "gold" | "emerald" | "danger";
  className?: string;
}) {
  const tones = {
    neutral: "bg-white/10 text-cream/85 border-white/15",
    gold: "bg-gold/15 text-gold border-gold/30",
    emerald: "bg-emerald/15 text-emerald-light border-emerald/30",
    danger: "bg-rose-500/15 text-rose-200 border-rose-400/30",
  };
  return (
    <span
      className={clsx(
        "inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-bold uppercase tracking-wider",
        tones[tone],
        className,
      )}
    >
      {children}
    </span>
  );
}
