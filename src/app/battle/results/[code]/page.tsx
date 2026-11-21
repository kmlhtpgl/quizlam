"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { Crown, Trophy } from "lucide-react";
import { AVATARS, type Avatar, type PlayerView } from "@/lib/domain";
import type { BattleResult } from "@/lib/battleDomain";
import { useApp } from "@/components/layout/Providers";
import { useBattleRoom } from "@/hooks/useBattleRoom";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Pill } from "@/components/ui/Pill";
import { AvatarIcon } from "@/components/ui/Avatar";
import { Scoreboard } from "@/components/game/Scoreboard";
import { Confetti } from "@/components/game/Confetti";

interface HistoryRound {
  round: number;
  playerName: string;
  correct: boolean;
  selectedIndex: number | null;
  selectedText?: string | null;
  correctIndex: number | null;
  choices: string[];
  responseMs?: number | null;
  speedBonus?: number;
  streakBonus?: number;
  streakCount?: number;
  totalPoints?: number;
  bankedPoints?: number;
  scoreDelta?: number;
  explanation?: string;
}

interface HistoryGame {
  code: string;
  gameType?: string;
  createdAt: string;
  finishedAt: string | null;
  scores: Array<{ nickname: string; score: number; avatar: string }>;
  rounds: HistoryRound[];
}

function asRound(value: HistoryRound, index: number): BattleResult | null {
  if (!value || typeof value !== "object") return null;
  const totalPoints = value.totalPoints ?? value.bankedPoints ?? value.scoreDelta ?? 0;
  const speedBonus = value.speedBonus ?? 0;
  const streakBonus = value.streakBonus ?? 0;
  return {
    ...value,
    round: value.round ?? index + 1,
    playerName: value.playerName ?? "",
    correct: Boolean(value.correct),
    selectedIndex: value.selectedIndex ?? null,
    selectedText: value.selectedText ?? (value.selectedIndex === null ? null : value.choices?.[value.selectedIndex] ?? null),
    correctIndex: value.correctIndex ?? -1,
    choices: Array.isArray(value.choices) ? value.choices : [],
    responseMs: value.responseMs ?? 0,
    speedBonus,
    streakBonus,
    streakCount: value.streakCount ?? 0,
    totalPoints,
    pointsAwarded: totalPoints,
    scoreDelta: value.scoreDelta ?? totalPoints,
    timedOut: value.selectedIndex === null,
    skipped: false,
    answer: value.selectedText ?? "",
    explanation: value.explanation ?? "",
    source: null,
    playerId: null,
    penalty: 0,
    bankedPoints: totalPoints,
  } as BattleResult;
}

export default function BattleResultsPage() {
  const params = useParams<{ code: string }>();
  const code = (params.code ?? "").toUpperCase();
  const { t } = useApp();
  const { snapshot } = useBattleRoom(code, "viewer");
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

  const rawRounds = snapshot?.history ?? historyGame?.rounds ?? [];
  const rounds = (Array.isArray(rawRounds) ? rawRounds : []).map(asRound).filter((round): round is BattleResult => round !== null);
  const champion = players.find((player) => player.isWinner) ?? players[0];
  const loading = !snapshot && fetching;

  if (loading) return <div className="py-32 text-center text-cream/60">{t("common.loading")}</div>;

  return (
    <div className="mx-auto max-w-6xl px-4 py-10 sm:px-6">
      <Confetti active={snapshot?.phase === "finished"} />
      <div className="text-center">
        <Pill tone="gold">{code}</Pill>
        <h1 className="mt-4 text-4xl font-black text-cream sm:text-5xl">{t("battle.results.title")}</h1>
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
            <p className="mt-3 text-sm font-black uppercase tracking-[0.2em] text-cream/55">{t("battle.results.champion")}</p>
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
            <h2 className="mb-5 text-xl font-black text-gold">{t("battle.results.review")}</h2>
            {rounds.length === 0 ? (
              <p className="text-sm text-cream/50">{t("battle.results.noHistory")}</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full min-w-[46rem] border-collapse text-left text-sm">
                  <thead>
                    <tr className="text-[0.65rem] font-black uppercase tracking-widest text-cream/45">
                      <th className="pb-3 pr-3">{t("battle.results.round")}</th>
                      <th className="pb-3 pr-3">{t("common.player")}</th>
                      <th className="pb-3 pr-3">{t("battle.results.selected")}</th>
                      <th className="pb-3 pr-3">{t("battle.results.correctAnswer")}</th>
                      <th className="pb-3 pr-3 text-right">{t("battle.results.base")}</th>
                      <th className="pb-3 pr-3 text-right">{t("battle.results.speed")}</th>
                      <th className="pb-3 pr-3 text-right">{t("battle.results.streak")}</th>
                      <th className="pb-3 pr-3 text-right">{t("battle.results.total")}</th>
                      <th className="pb-3 text-right">{t("battle.results.time")}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {rounds.map((round, index) => {
                      const selected = round.selectedText ?? round.choices?.[round.selectedIndex ?? -1] ?? t("battle.play.noAnswer");
                      const correctAnswer = round.choices?.[round.correctIndex] ?? "";
                      const base = Math.max(0, round.totalPoints - round.speedBonus - round.streakBonus);
                      return (
                        <tr key={`${round.round}-${round.playerId ?? index}`} className="border-t border-white/10">
                          <td className="py-3 pr-3 font-black text-gold">{round.round}</td>
                          <td className="py-3 pr-3 font-bold text-cream">{round.playerName}</td>
                          <td className="py-3 pr-3">
                            <Pill tone={round.correct ? "emerald" : "danger"}>{selected}</Pill>
                          </td>
                          <td className="py-3 pr-3 text-cream/70">{correctAnswer}</td>
                          <td className="py-3 pr-3 text-right text-cream/70">{base}</td>
                          <td className="py-3 pr-3 text-right text-gold">+{round.speedBonus}</td>
                          <td className="py-3 pr-3 text-right text-gold">+{round.streakBonus}</td>
                          <td className="py-3 pr-3 text-right font-black text-emerald-light">{round.totalPoints}</td>
                          <td className="py-3 text-right text-cream/55">{((round.responseMs ?? 0) / 1000).toFixed(1)}s</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </Card>
        </>
      )}

      <div className="mt-8 flex flex-col justify-center gap-3 sm:flex-row">
        <Link href="/battle/create">
          <Button variant="gold">{t("results.newGame")}</Button>
        </Link>
        <Link href="/history">
          <Button variant="outline">{t("history.title")}</Button>
        </Link>
      </div>
    </div>
  );
}
