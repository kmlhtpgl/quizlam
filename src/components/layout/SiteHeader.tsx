"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { BookOpen, History, Home, Settings2, Sparkles } from "lucide-react";
import { Logo } from "./Logo";
import { LanguageSwitcher } from "./LanguageSwitcher";
import { SoundToggle } from "./SoundToggle";
import { useApp } from "./Providers";
import clsx from "clsx";

const links = [
  { href: "/", key: "common.home" as const, icon: Home },
  { href: "/how-to", key: "common.howTo" as const, icon: BookOpen },
  { href: "/history", key: "results.noHistory" as const, icon: History },
  { href: "/settings", key: "common.settings" as const, icon: Settings2 },
];

export function SiteHeader() {
  const pathname = usePathname();
  const { t } = useApp();
  return (
    <header className="sticky top-0 z-40 border-b border-white/10 bg-navy/80 backdrop-blur-xl">
      <div className="mx-auto flex max-w-7xl items-center justify-between gap-4 px-4 py-3 sm:px-6">
        <Link href="/" aria-label="Quizlam home">
          <Logo />
        </Link>
        <nav className="hidden items-center gap-1 md:flex" aria-label="Main navigation">
          {links.map((link) => {
            const active = pathname === link.href;
            const Icon = link.icon;
            return (
              <Link
                key={link.href}
                href={link.href}
                className={clsx(
                  "inline-flex items-center gap-2 rounded-full px-3 py-2 text-xs font-bold uppercase tracking-wider transition",
                  active ? "bg-gold/15 text-gold" : "text-cream/70 hover:bg-white/5 hover:text-cream",
                )}
              >
                <Icon size={15} />
                {link.href === "/history" ? t("history.title") : t(link.key)}
              </Link>
            );
          })}
        </nav>
        <div className="flex items-center gap-2">
          <LanguageSwitcher />
          <SoundToggle />
        </div>
      </div>
    </header>
  );
}

export function SiteFooter() {
  const { t } = useApp();
  return (
    <footer className="relative z-10 border-t border-white/10 px-4 py-8 text-center text-cream/50">
      <div className="mx-auto flex max-w-7xl flex-col items-center justify-between gap-4 sm:flex-row">
        <p className="text-sm">{t("common.tagline")}</p>
        <div className="flex items-center gap-4 text-xs font-bold uppercase tracking-wider">
          <Link href="/parent" className="transition hover:text-gold">
            Parent
          </Link>
          <Link href="/daily" className="inline-flex items-center gap-1 transition hover:text-gold">
            <Sparkles size={13} />
            {t("common.dailyChallenge")}
          </Link>
          <span>© {new Date().getFullYear()} Quizlam</span>
        </div>
      </div>
    </footer>
  );
}
