import type { HTMLAttributes, ReactNode } from "react";
import clsx from "clsx";

interface CardProps extends HTMLAttributes<HTMLDivElement> {
  children: ReactNode;
  strong?: boolean;
}

export function Card({ children, className, strong, ...props }: CardProps) {
  return (
    <div className={clsx("rounded-3xl p-6", strong ? "glass-card-strong" : "glass-card", className)} {...props}>
      {children}
    </div>
  );
}
