"use client";

import { Volume2, VolumeX } from "lucide-react";
import { useApp } from "./Providers";

export function SoundToggle() {
  const { soundEnabled, setSoundEnabled, t } = useApp();
  return (
    <button
      type="button"
      onClick={() => setSoundEnabled(!soundEnabled)}
      className="inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/5 px-3 py-2 text-xs font-bold uppercase tracking-wider text-cream/85 transition hover:border-gold/40 hover:text-gold"
      aria-label={t("common.sound")}
      aria-pressed={soundEnabled}
    >
      {soundEnabled ? <Volume2 size={15} /> : <VolumeX size={15} />}
      {soundEnabled ? t("common.on") : t("common.off")}
    </button>
  );
}
