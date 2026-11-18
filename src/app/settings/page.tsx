"use client";

import { useState } from "react";
import Link from "next/link";
import { ShieldCheck, Volume2 } from "lucide-react";
import { CATEGORIES, DIFFICULTIES, type GameConfig } from "@/lib/domain";
import { useApp } from "@/components/layout/Providers";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Pill } from "@/components/ui/Pill";

export default function SettingsPage() {
  const { t, language, setLanguage, soundEnabled, setSoundEnabled, defaults, setDefaults } = useApp();
  const [configOverride, setConfigOverride] = useState<GameConfig | null>(null);
  const config = configOverride ?? defaults;
  const [saved, setSaved] = useState(false);

  function save() {
    setDefaults({ ...config, language });
    setConfigOverride(null);
    setSaved(true);
    window.setTimeout(() => setSaved(false), 1800);
  }

  return (
    <div className="mx-auto max-w-3xl px-4 py-12 sm:px-6">
      <h1 className="text-4xl font-black text-cream sm:text-5xl">{t("settings.title")}</h1>
      <Card strong className="mt-8">
        <h2 className="mb-6 text-lg font-black text-gold">{t("settings.preferences")}</h2>
        <div className="space-y-6">
          <div className="grid gap-5 sm:grid-cols-2">
            <label className="block">
              <span className="mb-2 block text-xs font-bold uppercase tracking-widest text-cream/55">
                {t("settings.languageLabel")}
              </span>
              <select
                value={language}
                onChange={(event) => setLanguage(event.target.value as "en" | "tr")}
                className="w-full rounded-xl border border-white/15 bg-navy/70 px-3 py-3 text-sm text-cream"
              >
                <option value="en">English</option>
                <option value="tr">Türkçe</option>
              </select>
            </label>
            <div>
              <span className="mb-2 flex items-center gap-2 text-xs font-bold uppercase tracking-widest text-cream/55">
                <Volume2 size={14} />
                {t("settings.soundLabel")}
              </span>
              <div className="flex gap-2">
                <Button variant={soundEnabled ? "primary" : "ghost"} onClick={() => setSoundEnabled(true)}>
                  {t("common.on")}
                </Button>
                <Button variant={!soundEnabled ? "primary" : "ghost"} onClick={() => setSoundEnabled(false)}>
                  {t("common.off")}
                </Button>
              </div>
            </div>
          </div>

          <div className="grid gap-5 sm:grid-cols-3">
            <label className="block">
              <span className="mb-2 block text-xs font-bold uppercase tracking-widest text-cream/55">{t("settings.defaultTimer")}</span>
              <select
                value={config.timerSeconds}
                onChange={(event) => setConfigOverride({ ...config, timerSeconds: Number(event.target.value) as GameConfig["timerSeconds"] })}
                className="w-full rounded-xl border border-white/15 bg-navy/70 px-3 py-2 text-sm text-cream"
              >
                {[15, 30, 45, 60].map((value) => (
                  <option key={value} value={value}>{value}s</option>
                ))}
              </select>
            </label>
            <label className="block">
              <span className="mb-2 block text-xs font-bold uppercase tracking-widest text-cream/55">{t("settings.defaultRounds")}</span>
              <input
                type="number"
                min={1}
                max={50}
                value={config.rounds}
                onChange={(event) => setConfigOverride({ ...config, rounds: Number(event.target.value) })}
                className="w-full rounded-xl border border-white/15 bg-navy/70 px-3 py-2 text-sm text-cream"
              />
            </label>
            <label className="block">
              <span className="mb-2 block text-xs font-bold uppercase tracking-widest text-cream/55">{t("settings.defaultPenalty")}</span>
              <input
                type="number"
                min={0}
                max={200}
                step={25}
                value={config.penalty}
                onChange={(event) => setConfigOverride({ ...config, penalty: Number(event.target.value) })}
                className="w-full rounded-xl border border-white/15 bg-navy/70 px-3 py-2 text-sm text-cream"
              />
            </label>
          </div>

          <div>
            <span className="mb-3 block text-xs font-bold uppercase tracking-widest text-cream/55">{t("create.categories")}</span>
            <div className="flex flex-wrap gap-2">
              {CATEGORIES.map((category) => (
                <button
                  key={category}
                  type="button"
                  onClick={() =>
                    setConfigOverride({
                      ...config,
                      categories: config.categories.includes(category)
                        ? config.categories.filter((item) => item !== category)
                        : [...config.categories, category],
                    })
                  }
                  className={`rounded-full border px-3 py-1.5 text-xs font-bold transition ${
                    config.categories.includes(category)
                      ? "border-emerald bg-emerald/20 text-emerald-light"
                      : "border-white/10 bg-white/5 text-cream/55"
                  }`}
                >
                  {category}
                </button>
              ))}
            </div>
          </div>

          <div>
            <span className="mb-3 block text-xs font-bold uppercase tracking-widest text-cream/55">{t("create.difficulties")}</span>
            <div className="flex gap-2">
              {DIFFICULTIES.map((difficulty) => (
                <button
                  key={difficulty}
                  type="button"
                  onClick={() =>
                    setConfigOverride({
                      ...config,
                      difficulties: config.difficulties.includes(difficulty)
                        ? config.difficulties.filter((item) => item !== difficulty)
                        : [...config.difficulties, difficulty],
                    })
                  }
                  className={`rounded-xl border px-4 py-2 text-xs font-bold transition ${
                    config.difficulties.includes(difficulty)
                      ? "border-gold bg-gold/15 text-gold"
                      : "border-white/10 bg-white/5 text-cream/55"
                  }`}
                >
                  {t(`common.${difficulty}`)}
                </button>
              ))}
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-3 border-t border-white/10 pt-5">
            <Button variant="gold" onClick={save}>
              {t("common.save")}
            </Button>
            {saved && <Pill tone="emerald">{t("settings.saved")}</Pill>}
          </div>
        </div>
      </Card>

      <Card className="mt-6">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-start gap-3">
            <ShieldCheck size={26} className="mt-1 shrink-0 text-gold" />
            <div>
              <h2 className="font-black text-cream">{t("settings.parentControls")}</h2>
              <p className="mt-1 text-sm text-cream/55">{t("settings.parentPinHint")}</p>
            </div>
          </div>
          <Link href="/parent">
            <Button variant="outline">{t("parent.title")}</Button>
          </Link>
        </div>
      </Card>
    </div>
  );
}
