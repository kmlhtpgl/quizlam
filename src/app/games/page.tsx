"use client";

import Link from "next/link";
import { ArrowRight, Gamepad2, Swords, Trophy } from "lucide-react";
import { useApp } from "@/components/layout/Providers";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Pill } from "@/components/ui/Pill";

export default function GamesPage() {
  const { t } = useApp();
  const games = [
    {
      href: "/create",
      icon: Gamepad2,
      badge: t("games.wordBadge"),
      title: t("games.wordTitle"),
      body: t("games.wordBody"),
      action: t("games.wordAction"),
    },
    {
      href: "/mcq/create",
      icon: Trophy,
      badge: t("games.millionaireBadge"),
      title: t("games.millionaireTitle"),
      body: t("games.millionaireBody"),
      action: t("games.millionaireAction"),
    },
    {
      href: "/battle/create",
      icon: Swords,
      badge: t("games.battleBadge"),
      title: t("games.battleTitle"),
      body: t("games.battleBody"),
      action: t("games.battleAction"),
    },
  ];

  return (
    <div className="mx-auto max-w-6xl px-4 py-12 sm:px-6">
      <div className="text-center">
        <h1 className="text-4xl font-black text-cream sm:text-5xl">{t("games.title")}</h1>
        <p className="mt-3 text-cream/60">{t("games.subtitle")}</p>
      </div>
      <div className="mt-10 grid gap-6 md:grid-cols-3">
        {games.map((game) => {
          const Icon = game.icon;
          return (
            <Card key={game.href} strong className="flex flex-col">
              <Pill tone="gold">{game.badge}</Pill>
              <div className="mt-6 inline-flex h-16 w-16 items-center justify-center rounded-3xl bg-gold/15 text-gold">
                <Icon size={34} />
              </div>
              <h2 className="mt-6 text-3xl font-black text-cream">{game.title}</h2>
              <p className="mt-3 flex-1 text-sm leading-relaxed text-cream/60">{game.body}</p>
              <Link href={game.href} className="mt-8">
                <Button size="lg" variant="gold" className="w-full">
                  {game.action}
                  <ArrowRight size={18} />
                </Button>
              </Link>
            </Card>
          );
        })}
      </div>
      <div className="mt-8 text-center text-sm text-cream/50">{t("games.joinHint")}</div>
    </div>
  );
}
