"use client";

import { CheckCircle2, Lightbulb, XCircle } from "lucide-react";
import type { RoundResult } from "@/lib/domain";
import { useApp } from "@/components/layout/Providers";
import { Confetti } from "./Confetti";
import clsx from "clsx";

export function ResultOverlay({ result, compact = false }: { result: RoundResult; compact?: boolean }) {
  const { t } = useApp();
  const isCorrect = result.correct;
  const icon = isCorrect ? <CheckCircle2 size={compact ? 32 : 48} /> : <XCircle size={compact ? 32 : 48} />;
  return (
    <div
      className={clsx(
        "pop-in relative overflow-hidden rounded-3xl border text-center",
        compact ? "p-5" : "p-8 sm:p-10",
        isCorrect ? "border-emerald/40 bg-emerald/10" : "border-rose-400/30 bg-rose-500/10",
      )}
      role="status"
      aria-live="polite"
    >
      <Confetti active={isCorrect} />
      <div className={clsx("mx-auto mb-3 flex justify-center", isCorrect ? "text-emerald-light" : "text-rose-300")}>
        {icon}
      </div>
      <h2 className={clsx("font-black", compact ? "text-xl" : "text-3xl sm:text-4xl")}>
        {result.skipped ? t("tv.hostRevealed") : result.timedOut ? t("common.timeUp") : isCorrect ? t("common.correct") : t("common.incorrect")}
      </h2>
      {result.playerName && (
        <p className="mt-1 text-sm font-semibold text-cream/70">{result.playerName}</p>
      )}
      <p className="mt-4 text-xs font-bold uppercase tracking-[0.2em] text-cream/50">{t("common.answer")}</p>
      <p className="mt-1 break-words text-2xl font-black tracking-widest text-gold sm:text-4xl">{result.answer}</p>
      {result.pointsAwarded > 0 && (
        <p className="mt-3 text-lg font-black text-emerald-light">+{result.pointsAwarded} {t("common.points")}</p>
      )}
      {result.penalty > 0 && (
        <p className="mt-3 text-lg font-black text-rose-300">-{result.penalty} {t("common.points")}</p>
      )}
      {result.explanation && (
        <div className="mt-5 rounded-2xl border border-white/10 bg-navy/40 p-4 text-left">
          <p className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-gold">
            <Lightbulb size={14} />
            {t("common.explanation")}
          </p>
          <p className="mt-2 text-sm leading-relaxed text-cream/80">{result.explanation}</p>
          {result.source && <p className="mt-2 text-xs text-cream/45">{t("common.source")}: {result.source}</p>}
        </div>
      )}
    </div>
  );
}
