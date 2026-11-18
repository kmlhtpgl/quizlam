import clsx from "clsx";

export function Logo({ compact = false }: { compact?: boolean }) {
  return (
    <span className="inline-flex items-center gap-3">
      <span className="relative inline-flex h-11 w-11 items-center justify-center">
        <svg viewBox="0 0 48 48" className="absolute inset-0 h-full w-full" aria-hidden="true">
          <path
            d="M24 2 29 13 41 15 32 24 35 36 24 30 13 36 16 24 7 15 19 13Z"
            fill="url(#logoGold)"
            stroke="#F5C451"
            strokeWidth="1.5"
          />
          <defs>
            <linearGradient id="logoGold" x1="0" y1="0" x2="1" y2="1">
              <stop offset="0" stopColor="#F5C451" />
              <stop offset="1" stopColor="#FFF2B8" />
            </linearGradient>
          </defs>
        </svg>
        <span className="relative text-navy text-sm font-black">Q</span>
      </span>
      {!compact && (
        <span className="text-2xl font-black tracking-[0.18em] gold-text" style={{ fontFamily: "var(--font-display)" }}>
          QUIZLAM
        </span>
      )}
    </span>
  );
}

export function LogoLockup({ className }: { className?: string }) {
  return (
    <div className={clsx("flex flex-col items-center text-center", className)}>
      <div className="mb-4 scale-150">
        <Logo compact />
      </div>
      <h1 className="text-5xl font-black tracking-[0.16em] gold-text sm:text-7xl" style={{ fontFamily: "var(--font-display)" }}>
        QUIZLAM
      </h1>
      <div className="mt-3 h-1 w-32 rounded-full bg-gradient-to-r from-transparent via-gold to-transparent" />
    </div>
  );
}
