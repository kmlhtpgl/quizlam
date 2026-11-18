"use client";

import type { ReactNode } from "react";
import { usePathname } from "next/navigation";
import { GeometricBackground } from "./GeometricBackground";
import { SiteFooter, SiteHeader } from "./SiteHeader";

export function AppShell({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const immersive = pathname.startsWith("/tv/") || pathname.startsWith("/play/");

  return (
    <div className="relative min-h-screen">
      <GeometricBackground />
      {!immersive && <SiteHeader />}
      <main className={`relative z-10 ${immersive ? "" : "min-h-[calc(100vh-9rem)]"}`}>{children}</main>
      {!immersive && <SiteFooter />}
    </div>
  );
}
