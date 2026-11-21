"use client";

import { Music, VolumeX } from "lucide-react";
import { useApp } from "./Providers";

export function MusicToggle() {
  const { musicEnabled, setMusicEnabled, t } = useApp();
  return (
    <button
      type="button"
      onClick={() => setMusicEnabled(!musicEnabled)}
      className="inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/5 px-3 py-2 text-xs font-bold uppercase tracking-wider text-cream/85 transition hover:border-gold/40 hover:text-gold"
      aria-label={t("common.music")}
      aria-pressed={musicEnabled}
    >
      {musicEnabled ? <Music size={15} /> : <VolumeX size={15} />}
      {musicEnabled ? t("common.on") : t("common.off")}
    </button>
  );
}
