"use client";

import Link from "next/link";
import { ArrowRight, BookOpen, Gamepad2, Languages, Radio, Sparkles, Trophy, Users } from "lucide-react";
import { LogoLockup } from "@/components/layout/Logo";
import { Button } from "@/components/ui/Button";
import { useApp } from "@/components/layout/Providers";

export default function HomePage() {
  const { t } = useApp();
  return (
    <div className="mx-auto max-w-7xl px-4 py-12 sm:px-6 sm:py-20">
      <section className="relative overflow-hidden rounded-[2.5rem] border border-white/10 bg-gradient-to-br from-navy-light/70 via-navy/80 to-emerald/10 px-6 py-16 text-center shadow-2xl sm:px-12 sm:py-24">
        <div className="pointer-events-none absolute inset-0 opacity-30">
          <div className="absolute left-1/2 top-0 h-96 w-96 -translate-x-1/2 rounded-full bg-emerald/20 blur-3xl" />
        </div>
        <div className="relative">
          <LogoLockup />
          <p className="mx-auto mt-8 max-w-2xl text-lg font-semibold tracking-wide text-gold sm:text-2xl">{t("common.tagline")}</p>
          <h1 className="mx-auto mt-6 max-w-3xl text-3xl font-black leading-tight text-cream sm:text-5xl">
            {t("home.heroTitle")}
          </h1>
          <p className="mx-auto mt-5 max-w-2xl text-base leading-relaxed text-cream/65 sm:text-lg">
            {t("home.heroSubtitle")}
          </p>
          <div className="mt-10 flex flex-col items-center justify-center gap-4 sm:flex-row">
            <Link href="/games">
              <Button size="lg" variant="gold" className="w-full btn-glow sm:w-auto">
                <Gamepad2 size={20} />
                {t("home.ctaPrimary")}
                <ArrowRight size={18} />
              </Button>
            </Link>
            <Link href="/join">
              <Button size="lg" variant="ghost" className="w-full sm:w-auto">
                <Radio size={20} />
                {t("home.ctaSecondary")}
              </Button>
            </Link>
          </div>
          <div className="mt-14 grid grid-cols-3 gap-3 border-t border-white/10 pt-8 sm:gap-8">
            {[
              { value: "750+", label: t("home.statsQuestions") },
              { value: "2-6", label: t("home.statsPlayers") },
              { value: "EN / TR", label: t("home.statsLanguages") },
            ].map((stat) => (
              <div key={stat.label}>
                <div className="text-2xl font-black text-gold sm:text-4xl">{stat.value}</div>
                <div className="mt-1 text-[0.65rem] font-bold uppercase tracking-[0.18em] text-cream/50 sm:text-xs">
                  {stat.label}
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="mt-14">
        <h2 className="text-center text-2xl font-black text-cream sm:text-3xl">{t("games.title")}</h2>
        <p className="mt-2 text-center text-sm text-cream/55">{t("games.subtitle")}</p>
        <div className="mt-6 grid gap-5 md:grid-cols-2">
          <Link href="/create" className="glass-card flex items-center gap-5 rounded-3xl p-6 transition hover:-translate-y-1 hover:border-gold/30">
            <div className="inline-flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-gold/15 text-gold">
              <Gamepad2 size={28} />
            </div>
            <div>
              <h3 className="text-xl font-black text-cream">{t("games.wordTitle")}</h3>
              <p className="mt-1 text-sm text-cream/55">{t("games.wordBody")}</p>
            </div>
          </Link>
          <Link href="/mcq/create" className="glass-card flex items-center gap-5 rounded-3xl p-6 transition hover:-translate-y-1 hover:border-gold/30">
            <div className="inline-flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-emerald/15 text-emerald-light">
              <Trophy size={28} />
            </div>
            <div>
              <h3 className="text-xl font-black text-cream">{t("games.millionaireTitle")}</h3>
              <p className="mt-1 text-sm text-cream/55">{t("games.millionaireBody")}</p>
            </div>
          </Link>
        </div>
      </section>

      <section className="mt-14 grid gap-5 md:grid-cols-3">
        {[
          { icon: Radio, title: t("home.feature1Title"), body: t("home.feature1Body") },
          { icon: BookOpen, title: t("home.feature2Title"), body: t("home.feature2Body") },
          { icon: Users, title: t("home.feature3Title"), body: t("home.feature3Body") },
        ].map((feature) => {
          const Icon = feature.icon;
          return (
            <div key={feature.title} className="glass-card rounded-3xl p-7 transition hover:-translate-y-1 hover:border-gold/30">
              <div className="mb-5 inline-flex h-12 w-12 items-center justify-center rounded-2xl bg-gold/15 text-gold">
                <Icon size={24} />
              </div>
              <h2 className="text-xl font-black text-cream">{feature.title}</h2>
              <p className="mt-3 text-sm leading-relaxed text-cream/60">{feature.body}</p>
            </div>
          );
        })}
      </section>

      <section className="mt-8 flex flex-col items-center justify-between gap-4 rounded-3xl border border-emerald/20 bg-emerald/10 p-6 sm:flex-row">
        <div className="flex items-center gap-4">
          <div className="rounded-2xl bg-emerald/20 p-3 text-emerald-light">
            <Languages size={24} />
          </div>
          <div>
            <p className="font-black text-cream">{t("common.dailyChallenge")}</p>
            <p className="text-sm text-cream/60">{t("daily.subtitle")}</p>
          </div>
        </div>
        <Link href="/daily">
          <Button variant="outline">
            <Sparkles size={16} />
            {t("daily.start")}
          </Button>
        </Link>
      </section>

      <div className="mt-10 text-center">
        <Link href="/how-to" className="inline-flex items-center gap-2 text-sm font-bold text-gold hover:underline">
          {t("common.howTo")}
          <ArrowRight size={15} />
        </Link>
      </div>
    </div>
  );
}
