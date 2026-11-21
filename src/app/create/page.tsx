"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Plus, Trash2 } from "lucide-react";
import { AVATARS, CATEGORIES, DIFFICULTIES, GAME_MODES, type Avatar, type Category, type Difficulty, type GameConfig } from "@/lib/domain";
import { useApp } from "@/components/layout/Providers";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { AvatarIcon } from "@/components/ui/Avatar";
import { setHostSession } from "@/lib/session";
import { emitWithAck } from "@/lib/socket";

interface LocalPlayer {
  nickname: string;
  avatar: Avatar;
}

export default function CreatePage() {
  const router = useRouter();
  const { t, defaults, language } = useApp();
  const [config, setConfig] = useState<GameConfig>(() => ({ ...defaults, categories: [], language }));
  const [localPlayers, setLocalPlayers] = useState<LocalPlayer[]>([
    { nickname: "Ekrem", avatar: "lion" },
    { nickname: "Zeynep", avatar: "star" },
  ]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const modeLabels = useMemo<Record<GameConfig["mode"], string>>(
    () => ({
      individual: t("create.individual"),
      team: t("create.team"),
      family: t("create.family"),
      tournament: t("create.tournament"),
      daily: t("create.daily"),
    }),
    [t],
  );

  const difficultyLabels = useMemo<Record<Difficulty, string>>(
    () => ({ easy: t("common.easy"), medium: t("common.medium"), hard: t("common.hard") }),
    [t],
  );

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
    const response = await emitWithAck("room:create", {
      config,
      localPlayers: config.mode === "family" || config.mode === "tournament" ? localPlayers : [],
    });
    setBusy(false);
    if (!response.ok || typeof response.code !== "string" || typeof response.hostToken !== "string") {
      setError(response.error ?? "CREATE_FAILED");
      return;
    }
    setHostSession(response.code, response.hostToken);
    router.push(`/host/${response.code}`);
  }

  return (
    <div className="mx-auto max-w-6xl px-4 py-10 sm:px-6">
      <div className="mb-8 text-center">
        <h1 className="text-4xl font-black text-cream sm:text-5xl">{t("create.title")}</h1>
        <p className="mt-3 text-cream/60">{t("create.subtitle")}</p>
      </div>

      <div className="grid gap-6 lg:grid-cols-[1.4fr_1fr]">
        <Card strong>
          <h2 className="mb-5 text-lg font-black text-gold">{t("create.gameSetup")}</h2>
          <div className="space-y-6">
            <div>
              <label className="mb-3 block text-xs font-bold uppercase tracking-widest text-cream/60">{t("create.categories")}</label>
              <div className="flex flex-wrap gap-2">
                {CATEGORIES.map((category) => {
                  const active = config.categories.includes(category);
                  return (
                    <button
                      key={category}
                      type="button"
                      onClick={() => toggleCategory(category)}
                      className={`rounded-full border px-3 py-1.5 text-xs font-bold transition ${
                        active ? "border-emerald bg-emerald/20 text-emerald-light" : "border-white/10 bg-white/5 text-cream/60 hover:border-white/25"
                      }`}
                    >
                      {category}
                    </button>
                  );
                })}
              </div>
            </div>

            <div className="grid gap-5 sm:grid-cols-2">
              <div>
                <label className="mb-3 block text-xs font-bold uppercase tracking-widest text-cream/60">{t("create.difficulties")}</label>
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
              <div>
                <label className="mb-3 block text-xs font-bold uppercase tracking-widest text-cream/60">{t("create.timer")}</label>
                <select
                  value={config.timerSeconds}
                  onChange={(event) =>
                    setConfig({ ...config, timerSeconds: Number(event.target.value) as GameConfig["timerSeconds"] })
                  }
                  className="w-full rounded-xl border border-white/15 bg-navy/70 px-3 py-2 text-sm text-cream"
                >
                  {[15, 30, 45, 60].map((value) => (
                    <option key={value} value={value}>{value}s</option>
                  ))}
                </select>
              </div>
            </div>

            <div className="grid gap-5 sm:grid-cols-3">
              <label className="block">
                <span className="mb-2 block text-xs font-bold uppercase tracking-widest text-cream/60">{t("create.rounds")}</span>
                <input
                  type="number"
                  min={1}
                  max={50}
                  value={config.rounds}
                  onChange={(event) => setConfig({ ...config, rounds: Number(event.target.value) })}
                  className="w-full rounded-xl border border-white/15 bg-navy/70 px-3 py-2 text-sm text-cream"
                />
              </label>
              <label className="block">
                <span className="mb-2 block text-xs font-bold uppercase tracking-widest text-cream/60">{t("create.penalty")}</span>
                <input
                  type="number"
                  min={0}
                  max={200}
                  step={25}
                  value={config.penalty}
                  onChange={(event) => setConfig({ ...config, penalty: Number(event.target.value) })}
                  className="w-full rounded-xl border border-white/15 bg-navy/70 px-3 py-2 text-sm text-cream"
                />
              </label>
              <label className="block">
                <span className="mb-2 block text-xs font-bold uppercase tracking-widest text-cream/60">{t("create.language")}</span>
                <select
                  value={config.language}
                  onChange={(event) => setConfig({ ...config, language: event.target.value as GameConfig["language"] })}
                  className="w-full rounded-xl border border-white/15 bg-navy/70 px-3 py-2 text-sm text-cream"
                >
                  <option value="en">English</option>
                  <option value="tr">Türkçe</option>
                </select>
              </label>
            </div>

            <div>
              <label className="mb-3 block text-xs font-bold uppercase tracking-widest text-cream/60">{t("create.mode")}</label>
              <select
                value={config.mode}
                onChange={(event) => setConfig({ ...config, mode: event.target.value as GameConfig["mode"] })}
                className="w-full rounded-xl border border-white/15 bg-navy/70 px-3 py-3 text-sm font-bold text-cream"
              >
                {GAME_MODES.map((mode) => (
                  <option key={mode} value={mode}>{modeLabels[mode]}</option>
                ))}
              </select>
              {(config.mode === "family" || config.mode === "tournament") && (
                <p className="mt-2 text-xs text-cream/45">{t("create.familyHint")}</p>
              )}
            </div>
          </div>
        </Card>

        <div className="space-y-6">
          {(config.mode === "family" || config.mode === "tournament") && (
            <Card>
              <h2 className="mb-4 text-lg font-black text-gold">{t("create.localPlayers")}</h2>
              <div className="space-y-3">
                {localPlayers.map((player, index) => (
                  <div key={index} className="flex items-center gap-3 rounded-2xl border border-white/10 bg-white/5 p-3">
                    <AvatarIcon avatar={player.avatar} size="sm" />
                    <input
                      value={player.nickname}
                      onChange={(event) =>
                        setLocalPlayers((current) =>
                          current.map((item, itemIndex) =>
                            itemIndex === index ? { ...item, nickname: event.target.value } : item,
                          ),
                        )
                      }
                      className="min-w-0 flex-1 rounded-lg border border-white/10 bg-navy/60 px-3 py-2 text-sm text-cream"
                      aria-label={`${t("create.playerName")} ${index + 1}`}
                    />
                    <select
                      value={player.avatar}
                      onChange={(event) =>
                        setLocalPlayers((current) =>
                          current.map((item, itemIndex) =>
                            itemIndex === index ? { ...item, avatar: event.target.value as Avatar } : item,
                          ),
                        )
                      }
                      className="rounded-lg border border-white/10 bg-navy/60 px-2 py-2 text-xs text-cream"
                      aria-label={`${t("create.avatar")} ${index + 1}`}
                    >
                      {AVATARS.map((avatar) => (
                        <option key={avatar} value={avatar}>{avatar}</option>
                      ))}
                    </select>
                    <button
                      type="button"
                      onClick={() => setLocalPlayers((current) => current.filter((_, itemIndex) => itemIndex !== index))}
                      className="text-cream/40 transition hover:text-rose-300"
                      aria-label={t("common.delete")}
                    >
                      <Trash2 size={17} />
                    </button>
                  </div>
                ))}
              </div>
              <Button
                type="button"
                variant="ghost"
                className="mt-4 w-full"
                onClick={() => setLocalPlayers((current) => [...current, { nickname: `Player ${current.length + 1}`, avatar: AVATARS[current.length % AVATARS.length] ?? "star" }])}
                disabled={localPlayers.length >= 6}
              >
                <Plus size={16} />
                {t("create.addPlayer")}
              </Button>
            </Card>
          )}

          <Card strong>
            <Button size="lg" variant="gold" className="w-full btn-glow" onClick={createRoom} disabled={busy || !config.categories.length || !config.difficulties.length}>
              {busy ? t("create.creating") : t("create.createButton")}
            </Button>
            {error && <p className="mt-3 text-center text-sm font-bold text-rose-300">{error}</p>}
          </Card>
        </div>
      </div>
    </div>
  );
}
