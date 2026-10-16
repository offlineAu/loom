import { cn } from "cn";
import type { ComponentPropsWithoutRef } from "react";

export type StatusTone = "neutral" | "primary" | "success" | "warning" | "destructive" | "info";

const TONE_CLASS: Record<StatusTone, string> = {
  neutral: "bg-muted text-muted-foreground",
  primary: "bg-accent text-accent-foreground",
  success: "bg-success/10 text-success",
  warning: "bg-warning/10 text-warning",
  destructive: "bg-destructive/10 text-destructive",
  info: "bg-info/10 text-info",
};

interface StatusBadgeProps extends ComponentPropsWithoutRef<"span"> {
  tone?: StatusTone;
}

/**
 * Generic small status pill, reused for catalog states ("Coming soon"),
 * and later for real sync/data states once persistence exists. Keeping
 * this generic (rather than a sync-specific component) avoids implying
 * synchronization exists before it's built.
 */
export function StatusBadge({ tone = "neutral", className, ...props }: StatusBadgeProps) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium",
        TONE_CLASS[tone],
        className
      )}
      {...props}
    />
  );
}
