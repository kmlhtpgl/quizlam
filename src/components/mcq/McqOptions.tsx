"use client";

import clsx from "clsx";
import type { McqChoiceView } from "@/lib/mcqDomain";

const LABELS = ["A", "B", "C", "D"];

export function McqOptions({
  options,
  correctIndex = null,
  selectedIndex = null,
  onSelect,
  disabled = false,
  compact = false,
}: {
  options: McqChoiceView[];
  correctIndex?: number | null;
  selectedIndex?: number | null;
  onSelect?: (index: number) => void;
  disabled?: boolean;
  compact?: boolean;
}) {
  const interactive = Boolean(onSelect) && !disabled;

  return (
    <div className={clsx("grid gap-3", compact ? "sm:grid-cols-2" : "sm:grid-cols-2")}>
      {options.map((option) => {
        const isCorrect = correctIndex === option.index;
        const isSelected = selectedIndex === option.index;
        const classes = clsx(
          "flex min-h-[3.5rem] w-full items-center gap-3 rounded-2xl border px-4 text-left font-bold transition",
          compact ? "text-sm" : "text-lg",
          option.eliminated && "border-white/5 bg-white/[0.02] opacity-30 line-through",
          !option.eliminated && isCorrect && "border-emerald bg-emerald/20 text-emerald-light",
          !option.eliminated && !isCorrect && isSelected && "border-rose-400/60 bg-rose-500/15 text-rose-200",
          !option.eliminated && !isCorrect && !isSelected && "border-white/12 bg-white/[0.06] text-cream",
          interactive && !option.eliminated && "cursor-pointer hover:border-gold/60 hover:bg-gold/10",
        );
        const content = (
          <>
            <span
              className={clsx(
                "flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border text-sm font-black",
                isCorrect ? "border-emerald/50 bg-emerald/20" : "border-gold/40 bg-gold/10 text-gold",
              )}
            >
              {LABELS[option.index] ?? String(option.index + 1)}
            </span>
            <span className="min-w-0 flex-1">{option.text}</span>
          </>
        );

        if (!onSelect) return <div key={option.index} className={classes}>{content}</div>;
        return (
          <button
            key={option.index}
            type="button"
            disabled={!interactive || option.eliminated}
            onClick={() => onSelect(option.index)}
            className={classes}
          >
            {content}
          </button>
        );
      })}
    </div>
  );
}
