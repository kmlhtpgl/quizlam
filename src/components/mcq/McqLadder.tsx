"use client";

import clsx from "clsx";
import { useApp } from "@/components/layout/Providers";
import { MCQ_LADDER, MCQ_MILESTONES } from "@/lib/mcqDomain";

export function McqLadder({
  roundIndex,
  bankedPoints,
  safeValue,
  compact = false,
}: {
  roundIndex: number;
  bankedPoints: number;
  safeValue: number;
  compact?: boolean;
}) {
  const { t } = useApp();
  const rows = MCQ_LADDER.map((value, index) => ({ value, index })).reverse();

  return (
    <div className="rounded-3xl border border-white/10 bg-white/[0.04] p-4">
      <h2 className="mb-3 text-center text-xs font-black uppercase tracking-[0.2em] text-gold">{t("mcq.ladder.title")}</h2>
      <div className={clsx("mx-auto grid gap-1", compact ? "max-w-[12rem]" : "max-w-sm")}>
        {rows.map((row) => {
          const current = row.index === roundIndex;
          const banked = row.value === bankedPoints && !current;
          const safe = row.value === safeValue && !current && !banked;
          const milestone = MCQ_MILESTONES.includes(row.index as (typeof MCQ_MILESTONES)[number]);
          return (
            <div
              key={row.index}
              className={clsx(
                "flex items-center justify-between rounded-lg px-3 py-1 text-xs font-bold transition",
                current && "bg-gold text-navy",
                banked && "bg-emerald/20 text-emerald-light",
                safe && "text-gold",
                !current && !banked && !safe && "text-cream/45",
              )}
            >
              <span className="w-6 text-right">{row.index + 1}.</span>
              <span className="flex-1 text-center">{row.value.toLocaleString("en-US")}</span>
              <span className="w-16 text-right text-[0.6rem] uppercase tracking-wider">
                {current ? t("mcq.ladder.current") : banked ? t("mcq.ladder.banked") : safe ? t("mcq.ladder.safe") : milestone ? "✓" : ""}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
