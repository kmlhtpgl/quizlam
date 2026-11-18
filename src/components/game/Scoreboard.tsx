"use client";

import { Crown } from "lucide-react";
import type { PlayerView } from "@/lib/domain";
import { AvatarIcon } from "@/components/ui/Avatar";
import { Pill } from "@/components/ui/Pill";
import { useApp } from "@/components/layout/Providers";

export function Scoreboard({
  players,
  compact = false,
  groupByTeam = false,
}: {
  players: PlayerView[];
  compact?: boolean;
  groupByTeam?: boolean;
}) {
  const { t } = useApp();
  const useTeams = groupByTeam && players.some((player) => player.teamId);
  const rows = useTeams
    ? Object.values(
        players.reduce<Record<string, { name: string; score: number; winners: string[] }>>((acc, player) => {
          const key = player.teamId ?? player.id;
          acc[key] ??= { name: key, score: 0, winners: [] };
          acc[key].score += player.score;
          if (player.isWinner) acc[key].winners.push(player.id);
          return acc;
        }, {}),
      ).map((row) => ({ ...row, id: row.name }))
    : players.map((player) => ({
        id: player.id,
        name: player.nickname,
        score: player.score,
        avatar: player.avatar,
        isActive: player.isActive,
        isWinner: player.isWinner,
        connected: player.connected,
      }));

  rows.sort((a, b) => b.score - a.score);
  const max = Math.max(1, ...rows.map((row) => row.score));

  return (
    <div className={compact ? "space-y-1.5" : "space-y-2.5"}>
      {rows.length === 0 && <p className="text-sm text-cream/50">{t("host.noPlayers")}</p>}
      {rows.map((row, index) => (
        <div
          key={row.id}
          className={`flex items-center gap-3 rounded-2xl border px-3 py-2 transition ${
            "isActive" in row && row.isActive
              ? "border-gold/50 bg-gold/10"
              : "border-white/10 bg-white/[0.04]"
          } ${compact ? "py-1.5" : ""}`}
        >
          <span className={`w-5 text-center text-sm font-black ${index === 0 ? "text-gold" : "text-cream/40"}`}>
            {index + 1}
          </span>
          {"avatar" in row && row.avatar && <AvatarIcon avatar={row.avatar} size="sm" active={"isActive" in row && Boolean(row.isActive)} />}
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2">
              <span className="truncate text-sm font-bold text-cream">{row.name}</span>
              {index === 0 && row.score > 0 && <Crown size={13} className="shrink-0 text-gold" />}
              {"connected" in row && !row.connected && <Pill tone="danger">offline</Pill>}
            </div>
            {!compact && (
              <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-white/10">
                <div
                  className="h-full rounded-full bg-gradient-to-r from-emerald to-gold transition-all duration-500"
                  style={{ width: `${Math.max(4, (row.score / max) * 100)}%` }}
                />
              </div>
            )}
          </div>
          <span className={`shrink-0 font-black ${index === 0 ? "text-gold" : "text-emerald-light"}`}>
            {row.score}
          </span>
        </div>
      ))}
    </div>
  );
}
