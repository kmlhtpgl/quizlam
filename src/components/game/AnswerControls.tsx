"use client";

import { useState } from "react";
import { Lightbulb, Send } from "lucide-react";
import { useApp } from "@/components/layout/Providers";
import { Button } from "@/components/ui/Button";

export function AnswerControls({
  disabled,
  canReveal,
  pointsAvailable,
  onReveal,
  onSubmit,
}: {
  disabled: boolean;
  canReveal: boolean;
  pointsAvailable: number;
  onReveal: () => void;
  onSubmit: (answer: string) => void;
}) {
  const { t } = useApp();
  const [answer, setAnswer] = useState("");

  return (
    <form
      className="space-y-3"
      onSubmit={(event) => {
        event.preventDefault();
        if (!answer.trim()) return;
        onSubmit(answer.trim());
        setAnswer("");
      }}
    >
      <label className="block">
        <span className="mb-2 block text-xs font-bold uppercase tracking-widest text-cream/60">{t("common.answer")}</span>
        <input
          value={answer}
          onChange={(event) => setAnswer(event.target.value)}
          disabled={disabled}
          placeholder={t("player.answerPlaceholder")}
          autoComplete="off"
          className="w-full rounded-2xl border border-white/15 bg-navy/70 px-4 py-4 text-center text-xl font-black uppercase tracking-widest text-cream placeholder:normal-case placeholder:tracking-normal placeholder:text-cream/30 focus:border-gold focus:outline-none disabled:opacity-50"
        />
      </label>
      <div className="grid grid-cols-2 gap-3">
        <Button type="button" variant="ghost" onClick={onReveal} disabled={disabled || !canReveal}>
          <Lightbulb size={17} />
          {t("player.revealLetter")}
        </Button>
        <Button type="submit" variant="gold" disabled={disabled || !answer.trim()}>
          <Send size={17} />
          {t("player.submitAnswer")}
        </Button>
      </div>
      <p className="text-center text-xs text-cream/45">
        {t("player.pointsAvailable")}: <span className="font-black text-gold">{pointsAvailable}</span>
      </p>
    </form>
  );
}
