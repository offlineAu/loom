import { AlertTriangle, WifiOff } from "lucide-react";
import { cn } from "cn";
import { Button } from "@/components/ui/button";
import { SectionTitle, SecondaryText } from "@/components/loom/typography";

interface ErrorStateProps {
  variant?: "error" | "offline";
  title: string;
  description?: string;
  onRetry?: () => void;
  className?: string;
}

/**
 * Platform-level recoverable error state, shared by every tracker. Errors
 * always offer a retry action rather than a dead end.
 */
export function ErrorState({
  variant = "error",
  title,
  description,
  onRetry,
  className,
}: ErrorStateProps) {
  const Icon = variant === "offline" ? WifiOff : AlertTriangle;

  return (
    <div
      role="alert"
      className={cn(
        "flex flex-col items-center gap-3 rounded-xl border border-border bg-card px-6 py-10 text-center shadow-sm",
        className
      )}
    >
      <span className="flex size-11 items-center justify-center rounded-full bg-destructive/10 text-destructive">
        <Icon className="size-5" aria-hidden="true" />
      </span>
      <SectionTitle>{title}</SectionTitle>
      {description ? <SecondaryText className="max-w-sm">{description}</SecondaryText> : null}
      {onRetry ? (
        <Button variant="outline" size="sm" className="mt-2" onClick={onRetry}>
          Try again
        </Button>
      ) : null}
    </div>
  );
}
