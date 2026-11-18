import { Bird, Cat, Cloud, Crown, Heart, Moon, Rocket, Sparkles, Star, Zap, type LucideIcon } from "lucide-react";
import type { Avatar } from "@/lib/domain";
import clsx from "clsx";

const icons: Record<Avatar, LucideIcon> = {
  lion: Crown,
  fox: Cat,
  owl: Bird,
  rocket: Rocket,
  star: Star,
  panda: Cloud,
  tiger: Zap,
  koala: Moon,
  dragon: Sparkles,
  unicorn: Heart,
};

const colors: Record<Avatar, string> = {
  lion: "from-amber-400 to-orange-500",
  fox: "from-orange-400 to-rose-500",
  owl: "from-sky-400 to-indigo-500",
  rocket: "from-cyan-400 to-blue-600",
  star: "from-yellow-300 to-gold",
  panda: "from-slate-200 to-slate-500",
  tiger: "from-orange-300 to-red-500",
  koala: "from-indigo-300 to-violet-600",
  dragon: "from-emerald-300 to-emerald",
  unicorn: "from-pink-300 to-fuchsia-500",
};

export function AvatarIcon({
  avatar,
  size = "md",
  active = false,
}: {
  avatar: Avatar;
  size?: "sm" | "md" | "lg" | "xl";
  active?: boolean;
}) {
  const Icon = icons[avatar] ?? Star;
  const sizes = {
    sm: "h-9 w-9 rounded-xl",
    md: "h-12 w-12 rounded-2xl",
    lg: "h-16 w-16 rounded-2xl",
    xl: "h-24 w-24 rounded-3xl",
  };
  const iconSizes = { sm: 18, md: 24, lg: 32, xl: 48 };
  return (
    <span
      className={clsx(
        "inline-flex shrink-0 items-center justify-center bg-gradient-to-br text-navy shadow-lg",
        colors[avatar] ?? colors.star,
        sizes[size],
        active && "ring-4 ring-gold ring-offset-2 ring-offset-navy",
      )}
      aria-hidden="true"
    >
      <Icon size={iconSizes[size]} strokeWidth={2.4} />
    </span>
  );
}
