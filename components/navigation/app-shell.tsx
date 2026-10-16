import type { ReactNode } from "react";
import { SiteHeader } from "@/components/navigation/site-header";
import { BottomNav } from "@/components/navigation/bottom-nav";
import { PersistenceNotice } from "@/components/loom/persistence-notice";

/**
 * Application shell: header + main content + mobile bottom nav. Every route
 * renders inside this so navigation stays consistent as trackers are added.
 */
export function AppShell({ children }: { children: ReactNode }) {
  return (
    <div className="flex min-h-full flex-col">
      <SiteHeader />
      <PersistenceNotice />
      <main className="mx-auto w-full max-w-5xl flex-1 px-4 pt-6 pb-20 sm:pb-10">{children}</main>
      <BottomNav />
    </div>
  );
}
