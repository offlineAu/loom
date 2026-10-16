import type { LucideIcon } from "lucide-react";
import { cn } from "cn";
import { SectionTitle, SecondaryText } from "@/components/loom/typography";

interface EmptyStateProps {
  icon?: LucideIcon;
  title: string;
  description?: string;
  action?: React.ReactNode;
  className?: string;
}

/**
 * Platform-level empty state. Every tracker reuses this rather than
 * inventing its own "nothing here yet" layout.
 */
export function EmptyState({ icon: Icon, title, description, action, className }: EmptyStateProps) {
  return (
    <div
      className={cn(
        "flex flex-col items-center gap-3 rounded-xl border border-dashed border-border bg-muted/40 px-6 py-12 text-center",
        className
      )}
    >
      {Icon ? (
        <span className="flex size-11 items-center justify-center rounded-full bg-background text-muted-foreground shadow-sm">
          <Icon className="size-5" aria-hidden="true" />
        </span>
      ) : null}
      <SectionTitle>{title}</SectionTitle>
      {description ? <SecondaryText className="max-w-sm">{description}</SecondaryText> : null}
      {action ? <div className="mt-2">{action}</div> : null}
    </div>
  );
}
