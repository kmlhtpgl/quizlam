"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { CalendarDays, ChevronRight, Trophy } from "lucide-react";
import type { Avatar, RoundResult } from "@/lib/domain";
import { AVATARS } from "@/lib/domain";
import { useApp } from "@/components/layout/Providers";
import { Card } from "@/components/ui/Card";
import { Pill } from "@/components/ui/Pill";
import { AvatarIcon } from "@/components/ui/Avatar";

interface HistoryGame {
  code: string;
  phase: string;
  config: { mode: string; language: string; rounds: number };
  createdAt: string;
  finishedAt: string | null;
  scores: Array<{ nickname: string; score: number; avatar: string }>;
  rounds: RoundResult[];
}

export default function HistoryPage() {
  const { t } = useApp();
  const [games, setGames] = useState<HistoryGame[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;
    fetch("/api/history")
      .then((response) => response.json() as Promise<{ games?: HistoryGame[] }>)
      .then((data) => {
        if (active) setGames(data.games ?? []);
      })
      .catch(() => undefined)
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, []);

  return (
    <div className="mx-auto max-w-5xl px-4 py-12 sm:px-6">
      <h1 className="text-4xl font-black text-cream sm:text-5xl">{t("history.title")}</h1>
      <p className="mt-3 text-cream/60">{t("history.subtitle")}</p>

      {loading ? (
        <p className="mt-10 text-cream/50">{t("common.loading")}</p>
      ) : games.length === 0 ? (
        <Card className="mt-10 text-center text-cream/60">{t("results.noHistory")}</Card>
      ) : (
        <div className="mt-8 space-y-4">
          {games.map((game) => (
            <Link key={game.code} href={`/results/${game.code}`} className="block">
              <Card className="flex flex-col gap-4 transition hover:border-gold/30 sm:flex-row sm:items-center">
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <Pill tone="gold">{game.code}</Pill>
                    <Pill tone={game.phase === "finished" ? "emerald" : "neutral"}>{game.phase}</Pill>
                    <span className="text-xs text-cream/45">{game.config.mode}</span>
                  </div>
                  <p className="mt-3 flex items-center gap-2 text-sm text-cream/55">
                    <CalendarDays size={15} />
                    {new Date(game.finishedAt ?? game.createdAt).toLocaleString()}
                  </p>
                  <div className="mt-4 flex flex-wrap gap-3">
                    {game.scores.slice(0, 4).map((score, index) => (
                      <div key={`${score.nickname}-${index}`} className="flex items-center gap-2 rounded-xl bg-white/5 px-2 py-1.5">
                        <AvatarIcon
                          avatar={(AVATARS.includes(score.avatar as Avatar) ? score.avatar : "star") as Avatar}
                          size="sm"
                          active={index === 0}
                        />
                        <span className="text-sm font-bold text-cream">{score.nickname}</span>
                        <span className="text-sm font-black text-gold">{score.score}</span>
                        {index === 0 && <Trophy size={13} className="text-gold" />}
                      </div>
                    ))}
                  </div>
                </div>
                <div className="text-right">
                  <p className="text-xs font-bold uppercase tracking-widest text-cream/40">{t("results.rounds")}</p>
                  <p className="text-2xl font-black text-cream">{game.rounds.length}</p>
                  <ChevronRight size={20} className="ml-auto mt-2 text-gold" />
                </div>
              </Card>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
