"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Home, LayoutGrid, User } from "lucide-react";
import { cn } from "cn";

const ITEMS = [
  { href: "/", label: "Home", icon: Home },
  { href: "/trackers", label: "Trackers", icon: LayoutGrid },
  { href: "/account", label: "Account", icon: User },
] as const;

/**
 * Mobile bottom navigation. Kept to three items intentionally — this is
 * the primary navigation surface on a phone; a sidebar is not the mobile
 * source of truth here.
 */
export function BottomNav() {
  const pathname = usePathname();

  return (
    <nav
      aria-label="Primary"
      className="fixed inset-x-0 bottom-0 z-40 border-t border-border bg-background/95 backdrop-saturate-150 supports-backdrop-filter:backdrop-blur-md sm:hidden"
      style={{ paddingBottom: "env(safe-area-inset-bottom)" }}
    >
      <ul className="flex h-14 items-stretch justify-around">
        {ITEMS.map(({ href, label, icon: Icon }) => {
          const active = href === "/" ? pathname === "/" : pathname.startsWith(href);
          return (
            <li key={href} className="flex-1">
              <Link
                href={href}
                aria-current={active ? "page" : undefined}
                className={cn(
                  "flex h-full flex-col items-center justify-center gap-0.5 text-xs font-medium",
                  active ? "text-primary" : "text-muted-foreground"
                )}
              >
                <Icon className="size-5" aria-hidden="true" />
                {label}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
