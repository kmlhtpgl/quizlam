"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import {
  CATEGORIES,
  DIFFICULTIES,
  LANGUAGES,
  type Category,
  type Difficulty,
  type Language,
} from "@/lib/domain";
import {
  BATTLE_DEFAULT_CONFIG,
  BATTLE_ROUND_OPTIONS,
  BATTLE_TIMER_OPTIONS,
  type BattleConfig,
} from "@/lib/battleDomain";
import { useApp } from "@/components/layout/Providers";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { setHostSession } from "@/lib/session";
import { emitWithAck } from "@/lib/socket";

export default function BattleCreatePage() {
  const router = useRouter();
  const { t, language } = useApp();
  const [config, setConfig] = useState<BattleConfig>(() => ({
    ...BATTLE_DEFAULT_CONFIG,
    categories: [],
    difficulties: [...BATTLE_DEFAULT_CONFIG.difficulties],
    language,
  }));
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const difficultyLabels: Record<Difficulty, string> = {
    easy: t("common.easy"),
    medium: t("common.medium"),
    hard: t("common.hard"),
  };

  function toggleCategory(category: Category) {
    setConfig((current) => ({
      ...current,
      categories: current.categories.includes(category)
        ? current.categories.filter((item) => item !== category)
        : [...current.categories, category],
    }));
  }

  function toggleDifficulty(difficulty: Difficulty) {
    setConfig((current) => ({
      ...current,
      difficulties: current.difficulties.includes(difficulty)
        ? current.difficulties.filter((item) => item !== difficulty)
        : [...current.difficulties, difficulty],
    }));
  }

  async function createRoom() {
    setBusy(true);
    setError("");
    const response = await emitWithAck("battle:create", { config });
    setBusy(false);
    if (!response.ok || typeof response.code !== "string" || typeof response.hostToken !== "string") {
      setError(response.error ?? "CREATE_FAILED");
      return;
    }
    setHostSession(response.code, response.hostToken);
    router.push(`/battle/host/${response.code}`);
  }

  return (
    <div className="mx-auto max-w-4xl px-4 py-10 sm:px-6">
      <div className="mb-8 text-center">
        <h1 className="text-4xl font-black text-cream sm:text-5xl">{t("battle.create.title")}</h1>
        <p className="mt-3 text-cream/60">{t("battle.create.subtitle")}</p>
      </div>

      <Card strong>
        <div className="space-y-6">
          <div>
            <label className="mb-3 block text-xs font-bold uppercase tracking-widest text-cream/60">{t("battle.create.categories")}</label>
            <div className="flex flex-wrap gap-2">
              {CATEGORIES.map((category) => {
                const active = config.categories.includes(category);
                return (
                  <button
                    key={category}
                    type="button"
                    onClick={() => toggleCategory(category)}
                    className={`rounded-full border px-3 py-1.5 text-xs font-bold transition ${
                      active
                        ? "border-emerald bg-emerald/20 text-emerald-light"
                        : "border-white/10 bg-white/5 text-cream/60 hover:border-white/25"
                    }`}
                  >
                    {category}
                  </button>
                );
              })}
            </div>
          </div>

          <div>
            <label className="mb-3 block text-xs font-bold uppercase tracking-widest text-cream/60">{t("battle.create.difficulties")}</label>
            <div className="flex gap-2">
              {DIFFICULTIES.map((difficulty) => (
                <button
                  key={difficulty}
                  type="button"
                  onClick={() => toggleDifficulty(difficulty)}
                  className={`flex-1 rounded-xl border px-3 py-2 text-xs font-bold transition ${
                    config.difficulties.includes(difficulty)
                      ? "border-gold bg-gold/15 text-gold"
                      : "border-white/10 bg-white/5 text-cream/60"
                  }`}
                >
                  {difficultyLabels[difficulty]}
                </button>
              ))}
            </div>
          </div>

          <div className="grid gap-5 sm:grid-cols-3">
            <div>
              <label className="mb-3 block text-xs font-bold uppercase tracking-widest text-cream/60">{t("battle.create.language")}</label>
              <div className="flex gap-2">
                {LANGUAGES.map((item) => (
                  <button
                    key={item}
                    type="button"
                    onClick={() => setConfig((current) => ({ ...current, language: item as Language }))}
                    className={`flex-1 rounded-xl border px-3 py-2 text-xs font-bold uppercase transition ${
                      config.language === item ? "border-emerald bg-emerald/20 text-emerald-light" : "border-white/10 bg-white/5 text-cream/60"
                    }`}
                  >
                    {item}
                  </button>
                ))}
              </div>
            </div>
            <div>
              <label className="mb-3 block text-xs font-bold uppercase tracking-widest text-cream/60">{t("battle.create.rounds")}</label>
              <select
                value={config.rounds}
                onChange={(event) => setConfig((current) => ({ ...current, rounds: Number(event.target.value) }))}
                className="w-full rounded-xl border border-white/15 bg-navy/70 px-3 py-2 text-sm text-cream"
              >
                {BATTLE_ROUND_OPTIONS.map((value) => (
                  <option key={value} value={value}>{value}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="mb-3 block text-xs font-bold uppercase tracking-widest text-cream/60">{t("battle.create.timer")}</label>
              <select
                value={config.timerSeconds}
                onChange={(event) => setConfig((current) => ({ ...current, timerSeconds: Number(event.target.value) }))}
                className="w-full rounded-xl border border-white/15 bg-navy/70 px-3 py-2 text-sm text-cream"
              >
                {BATTLE_TIMER_OPTIONS.map((value) => (
                  <option key={value} value={value}>{value}s</option>
                ))}
              </select>
            </div>
          </div>

          <p className="text-center text-sm font-bold text-emerald-light/80">
            {t("battle.create.roundCount", { count: config.rounds })}
          </p>
          <Button
            size="lg"
            variant="gold"
            className="w-full btn-glow"
            onClick={createRoom}
            disabled={busy || !config.categories.length || !config.difficulties.length}
          >
            {busy ? t("battle.create.creating") : t("battle.create.createButton")}
          </Button>
          {error && <p className="text-center text-sm font-bold text-rose-300">{error}</p>}
        </div>
      </Card>
    </div>
  );
}
