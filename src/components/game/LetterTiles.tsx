"use client";

import { motion } from "framer-motion";
import type { TileView } from "@/lib/domain";
import clsx from "clsx";

export function LetterTiles({ tiles, size = "md" }: { tiles: TileView[]; size?: "md" | "lg" | "xl" }) {
  const sizes = {
    md: "h-12 w-10 text-xl sm:h-14 sm:w-12 sm:text-2xl",
    lg: "h-20 w-16 text-4xl sm:h-24 sm:w-20 sm:text-5xl",
    xl: "h-24 w-20 text-5xl sm:h-32 sm:w-24 sm:text-6xl",
  };

  return (
    <div className="flex flex-wrap items-center justify-center gap-2 sm:gap-3" aria-label="Hidden answer letters">
      {tiles.map((tile) => {
        if (!tile.revealable) {
          return (
            <span
              key={`sep-${tile.position}`}
              className="flex h-full min-w-3 items-end justify-center pb-1 text-3xl font-black text-gold/50"
              aria-hidden="true"
            >
              {tile.char === " " ? "\u00A0" : tile.char}
            </span>
          );
        }
        return (
          <motion.div
            key={`${tile.position}-${tile.revealed ? "shown" : "hidden"}`}
            initial={tile.revealed ? { rotateX: 90, scale: 0.75, opacity: 0.3 } : false}
            animate={{ rotateX: 0, scale: 1, opacity: 1 }}
            transition={{ duration: 0.45, ease: [0.2, 0.8, 0.2, 1] }}
            className={clsx(
              "flex items-center justify-center rounded-xl border-2 font-black shadow-lg",
              sizes[size],
              tile.revealed
                ? "border-gold bg-gradient-to-b from-gold/25 to-gold/5 text-gold"
                : "border-cream/20 bg-navy/70 text-cream/25",
            )}
            aria-label={tile.revealed ? `Letter ${tile.char}` : "Hidden letter"}
          >
            {tile.revealed ? tile.char : "?"}
          </motion.div>
        );
      })}
    </div>
  );
}
