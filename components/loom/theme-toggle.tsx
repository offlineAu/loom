"use client";

import { Monitor, Moon, Sun } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useTheme } from "@/components/loom/theme-provider";

const CYCLE = ["system", "light", "dark"] as const;

const ICON = {
  system: Monitor,
  light: Sun,
  dark: Moon,
} as const;

/** Cycles system -> light -> dark -> system. A single tap target, mobile-friendly. */
export function ThemeToggle() {
  const { theme, setTheme } = useTheme();
  const Icon = ICON[theme];

  return (
    <Button
      variant="ghost"
      size="icon"
      aria-label={`Theme: ${theme}. Tap to change.`}
      onClick={() => {
        const next = CYCLE[(CYCLE.indexOf(theme) + 1) % CYCLE.length];
        setTheme(next);
      }}
    >
      <Icon className="size-4" aria-hidden="true" />
    </Button>
  );
}
