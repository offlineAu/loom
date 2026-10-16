import Link from "next/link";
import type { TrackerTemplate } from "@/lib/tracker/catalog";
import { CardTitle, SecondaryText } from "@/components/loom/typography";
import { StatusBadge } from "@/components/loom/status-badge";
import { cn } from "cn";

interface TrackerCardProps {
  template: TrackerTemplate;
}

/**
 * Generic card for one Tracker Template in the catalog. Presentation only —
 * it knows nothing about any tracker's domain logic, only its metadata.
 */
export function TrackerCard({ template }: TrackerCardProps) {
  const Icon = template.icon;
  const available = template.status === "available";

  const content = (
    <div
      className={cn(
        "group flex h-full flex-col gap-3 rounded-xl border border-border bg-card p-4 shadow-sm transition-all",
        available ? "hover:-translate-y-0.5 hover:shadow-md" : "opacity-70"
      )}
    >
      <div className="flex items-start justify-between gap-2">
        <span className="flex size-9 items-center justify-center rounded-lg bg-accent text-accent-foreground">
          <Icon className="size-4.5" aria-hidden="true" />
        </span>
        <StatusBadge tone={available ? "success" : "neutral"}>
          {available ? "Available" : "Coming soon"}
        </StatusBadge>
      </div>
      <div>
        <CardTitle>{template.label}</CardTitle>
        <SecondaryText className="mt-1">{template.description}</SecondaryText>
      </div>
    </div>
  );

  if (!available) {
    return (
      <div aria-disabled="true" className="cursor-not-allowed">
        {content}
      </div>
    );
  }

  return (
    <Link
      href={template.href ?? "#"}
      className="rounded-xl focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-ring/50"
    >
      {content}
    </Link>
  );
}
