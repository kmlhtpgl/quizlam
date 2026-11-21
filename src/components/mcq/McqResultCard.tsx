"use client";

import { CheckCircle2, Clock3, XCircle } from "lucide-react";
import { useApp } from "@/components/layout/Providers";
import { Card } from "@/components/ui/Card";
import { Pill } from "@/components/ui/Pill";
import type { McqResult } from "@/lib/mcqDomain";

export function McqResultCard({ result, compact = false }: { result: McqResult; compact?: boolean }) {
  const { t } = useApp();
  const Icon = result.correct ? CheckCircle2 : result.timedOut ? Clock3 : XCircle;
  const tone = result.correct ? "emerald" : "danger";

  return (
    <Card className={compact ? "p-4" : "p-6"}>
      <div className="flex items-center justify-between gap-3">
        <Pill tone={tone as "emerald" | "danger"}>
          <Icon size={13} />
          {result.correct ? t("mcq.tv.correct") : result.timedOut ? t("mcq.tv.timeUp") : t("mcq.tv.wrong")}
        </Pill>
        <span className="text-xs font-bold uppercase tracking-widest text-cream/45">
          {t("mcq.results.banked")}: <span className="text-gold">{result.bankedPoints.toLocaleString("en-US")}</span>
        </span>
      </div>
      <p className="mt-4 text-lg font-black text-cream">
        {t("mcq.tv.answerIs")}: <span className="text-gold">{result.answer}</span>
      </p>
      {result.selectedText && (
        <p className="mt-2 text-sm text-cream/60">
          {t("common.answer")}: <span className={result.correct ? "text-emerald-light" : "text-rose-300"}>{result.selectedText}</span>
        </p>
      )}
      {!compact && result.explanation && <p className="mt-4 text-sm leading-relaxed text-cream/60">{result.explanation}</p>}
      {!compact && result.source && <p className="mt-2 text-xs text-cream/35">{t("common.source")}: {result.source}</p>}
    </Card>
  );
}
