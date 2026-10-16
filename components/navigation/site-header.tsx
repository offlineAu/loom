import Link from "next/link";
import { Layers } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ThemeToggle } from "@/components/loom/theme-toggle";

/**
 * Top app bar. Visible on every route, including for anonymous visitors —
 * LOOM never gates the public experience behind sign-in.
 */
export function SiteHeader() {
  return (
    <header className="sticky top-0 z-40 border-b border-border bg-background/80 backdrop-saturate-150 supports-backdrop-filter:backdrop-blur-md">
      <div className="mx-auto flex h-14 max-w-5xl items-center justify-between px-4">
        <Link href="/" className="flex items-center gap-2 font-semibold tracking-tight">
          <span className="flex size-7 items-center justify-center rounded-lg bg-primary text-primary-foreground">
            <Layers className="size-4" aria-hidden="true" />
          </span>
          LOOM
        </Link>

        <nav className="hidden items-center gap-1 sm:flex" aria-label="Primary">
          <Button variant="ghost" size="sm" render={<Link href="/trackers" />}>
            Trackers
          </Button>
          <Button variant="ghost" size="sm" render={<Link href="/account" />}>
            Account
          </Button>
        </nav>

        <div className="flex items-center gap-1">
          <ThemeToggle />
          <Button size="sm" className="hidden sm:inline-flex" render={<Link href="/trackers/debt" />}>
            Start a tracker
          </Button>
        </div>
      </div>
    </header>
  );
}
