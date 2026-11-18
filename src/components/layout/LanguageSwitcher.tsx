"use client";

import { Languages } from "lucide-react";
import { useApp } from "./Providers";

export function LanguageSwitcher() {
  const { language, setLanguage, t } = useApp();
  return (
    <button
      type="button"
      onClick={() => setLanguage(language === "en" ? "tr" : "en")}
      className="inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/5 px-3 py-2 text-xs font-bold uppercase tracking-wider text-cream/85 transition hover:border-gold/40 hover:text-gold"
      aria-label={t("common.language")}
    >
      <Languages size={15} />
      {language === "en" ? "EN" : "TR"}
    </button>
  );
}
