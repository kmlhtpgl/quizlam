"use client";

import type { ButtonHTMLAttributes, ReactNode } from "react";
import clsx from "clsx";

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: "primary" | "gold" | "ghost" | "outline" | "danger";
  size?: "sm" | "md" | "lg";
  children: ReactNode;
}

const variants: Record<NonNullable<ButtonProps["variant"]>, string> = {
  primary: "bg-emerald text-navy hover:bg-emerald-light",
  gold: "bg-gold text-navy hover:brightness-110",
  ghost: "bg-white/5 text-cream hover:bg-white/10 border border-white/10",
  outline: "border border-gold/60 text-gold hover:bg-gold/10",
  danger: "bg-rose-500/90 text-white hover:bg-rose-500",
};

const sizes: Record<NonNullable<ButtonProps["size"]>, string> = {
  sm: "px-3 py-2 text-sm rounded-xl",
  md: "px-5 py-3 text-sm rounded-2xl",
  lg: "px-8 py-4 text-base rounded-2xl",
};

export function Button({ variant = "primary", size = "md", className, children, ...props }: ButtonProps) {
  return (
    <button
      className={clsx(
        "inline-flex items-center justify-center gap-2 font-bold tracking-wide transition-all duration-200 disabled:cursor-not-allowed disabled:opacity-50 active:scale-[0.98]",
        variants[variant],
        sizes[size],
        className,
      )}
      {...props}
    >
      {children}
    </button>
  );
}
