"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { Crown, Trophy } from "lucide-react";
import type { Avatar, PlayerView } from "@/lib/domain";
import { AVATARS } from "@/lib/domain";
import type { McqRoomSnapshot } from "@/lib/mcqDomain";
import { useApp } from "@/components/layout/Providers";
import { useMcqRoom } from "@/hooks/useMcqRoom";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Pill } from "@/components/ui/Pill";
import { AvatarIcon } from "@/components/ui/Avatar";
import { Scoreboard } from "@/components/game/Scoreboard";
import { McqOptions } from "@/components/mcq/McqOptions";

interface HistoryRound {
  round: number;
  playerName: string;
  answer: string;
  explanation: string;
  choices: string[];
  selectedIndex: number | null;
  correctIndex: number | null;
  bankedPoints: number;
  correct: boolean;
  timedOut: boolean;
}

interface HistoryGame {
  code: string;
  createdAt: string;
  finishedAt: string | null;
  scores: Array<{ nickname: string; score: number; avatar: string }>;
  rounds: HistoryRound[];
}

export default function McqResultsPage() {
  const params = useParams<{ code: string }>();
  const code = (params.code ?? "").toUpperCase();
  const { t } = useApp();
  const { snapshot } = useMcqRoom(code, "viewer");
  const [historyGame, setHistoryGame] = useState<HistoryGame | null>(null);
  const [fetching, setFetching] = useState(true);

  useEffect(() => {
    if (snapshot) return;
    let active = true;
    fetch("/api/history")
      .then((response) => response.json() as Promise<{ games?: HistoryGame[] }>)
      .then((data) => {
        if (active) setHistoryGame(data.games?.find((game) => game.code === code) ?? null);
      })
      .catch(() => undefined)
      .finally(() => {
        if (active) setFetching(false);
      });
    return () => {
      active = false;
    };
  }, [code, snapshot]);

  const players = useMemo<PlayerView[]>(() => {
    if (snapshot) return snapshot.players;
    return (historyGame?.scores ?? []).map((score, index) => ({
      id: `${score.nickname}-${index}`,
      nickname: score.nickname,
      avatar: (AVATARS.includes(score.avatar as Avatar) ? score.avatar : "star") as Avatar,
      teamId: null,
      score: score.score,
      connected: true,
      isLocal: false,
      isActive: false,
      isEligible: false,
      isWinner: index === 0,
    }));
  }, [historyGame, snapshot]);

  const live = snapshot as McqRoomSnapshot | null;
  const rounds = live?.history ?? historyGame?.rounds ?? [];
  const champion = players.find((player) => player.isWinner) ?? players[0];
  const loading = !snapshot && fetching;

  if (loading) return <div className="py-32 text-center text-cream/60">{t("common.loading")}</div>;

  return (
    <div className="mx-auto max-w-5xl px-4 py-10 sm:px-6">
      <div className="text-center">
        <Pill tone="gold">{code}</Pill>
        <h1 className="mt-4 text-4xl font-black text-cream sm:text-5xl">{t("mcq.results.title")}</h1>
        {live && (
          <p className="mt-3 text-sm text-cream/55">
            {t("mcq.results.banked")}: <span className="font-black text-gold">{live.bankedPoints.toLocaleString("en-US")}</span>
          </p>
        )}
        {historyGame?.finishedAt && (
          <p className="mt-3 text-sm text-cream/50">{t("results.playedOn")} {new Date(historyGame.finishedAt).toLocaleString()}</p>
        )}
      </div>

      {players.length === 0 ? (
        <Card className="mt-10 text-center text-cream/60">{t("results.noScores")}</Card>
      ) : (
        <>
          <Card strong className="mt-10 text-center">
            <Trophy size={56} className="mx-auto text-gold" />
            <p className="mt-3 text-sm font-black uppercase tracking-[0.2em] text-cream/55">{t("results.champion")}</p>
            {champion && (
              <div className="mt-5 flex flex-col items-center gap-3">
                <AvatarIcon avatar={champion.avatar} size="xl" active />
                <p className="text-3xl font-black text-cream sm:text-4xl">{champion.nickname}</p>
                <p className="text-2xl font-black text-gold">
                  <Crown size={20} className="mr-2 inline" />
                  {champion.score.toLocaleString("en-US")}
                </p>
              </div>
            )}
          </Card>

          <Card className="mt-6">
            <h2 className="mb-5 text-xl font-black text-gold">{t("common.finalScores")}</h2>
            <Scoreboard players={players} />
          </Card>

          <Card className="mt-6">
            <h2 className="mb-5 text-xl font-black text-gold">{t("common.review")}</h2>
            {rounds.length === 0 ? (
              <p className="text-sm text-cream/50">{t("results.noHistory")}</p>
            ) : (
              <div className="space-y-4">
                {rounds.map((round) => (
                  <div key={round.round} className="rounded-2xl border border-white/10 bg-white/[0.03] p-4">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <p className="text-sm font-black text-cream">
                        {t("common.round")} {round.round} · {round.playerName}
                      </p>
                      <Pill tone={round.correct ? "emerald" : "danger"}>
                        {t("mcq.results.banked")}: {round.bankedPoints.toLocaleString("en-US")}
                      </Pill>
                    </div>
                    {round.choices.length > 0 && (
                      <div className="mt-4">
                        <McqOptions
                          options={round.choices.map((text, index) => ({ index, text, eliminated: false }))}
                          correctIndex={round.correctIndex}
                          selectedIndex={round.selectedIndex}
                          compact
                        />
                      </div>
                    )}
                    {round.explanation && <p className="mt-3 text-xs leading-relaxed text-cream/50">{round.explanation}</p>}
                  </div>
                ))}
              </div>
            )}
          </Card>
        </>
      )}

      <div className="mt-8 flex flex-col justify-center gap-3 sm:flex-row">
        <Link href="/games">
          <Button variant="gold">{t("results.newGame")}</Button>
        </Link>
        <Link href="/history">
          <Button variant="outline">{t("history.title")}</Button>
        </Link>
      </div>
    </div>
  );
}
