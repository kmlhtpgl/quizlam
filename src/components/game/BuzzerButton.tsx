"use client";

import { Zap } from "lucide-react";
import clsx from "clsx";
import { useApp } from "@/components/layout/Providers";

export function BuzzerButton({
  onClick,
  disabled,
  state = "ready",
  label,
}: {
  onClick: () => void;
  disabled?: boolean;
  state?: "ready" | "active" | "locked" | "waiting";
  label: string;
}) {
  const { t } = useApp();
  const styles = {
    ready: "bg-gradient-to-br from-gold to-amber-500 text-navy buzzer-glow",
    active: "bg-gradient-to-br from-emerald-light to-emerald text-navy scale-105",
    locked: "bg-white/10 text-cream/40 border border-white/10",
    waiting: "bg-white/5 text-cream/50 border border-white/10",
  };
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-label={label}
      className={clsx(
        "relative flex aspect-square w-full max-w-[22rem] select-none flex-col items-center justify-center rounded-full border-4 border-white/20 font-black transition-all duration-200 active:scale-95 disabled:cursor-not-allowed",
        styles[state],
      )}
    >
      <Zap size={44} strokeWidth={2.6} className="mb-2" />
      <span className="text-3xl tracking-[0.12em] sm:text-4xl">{label}</span>
      <span className="mt-2 text-xs font-bold uppercase tracking-[0.2em] opacity-70">
        {state === "locked" ? t("player.locked") : state === "active" ? t("player.buzzing") : t("player.buzzerHint")}
      </span>
    </button>
  );
}
