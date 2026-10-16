import { cn } from "cn";
import { Caption, SecondaryText } from "@/components/loom/typography";

interface StatTileProps {
  label: string;
  value: string;
  caption?: string;
  className?: string;
}

/** Generic dashboard summary tile, reusable by any future tracker's dashboard. */
export function StatTile({ label, value, caption, className }: StatTileProps) {
  return (
    <div className={cn("rounded-xl border border-border bg-card p-4 shadow-sm", className)}>
      <SecondaryText className="mb-1">{label}</SecondaryText>
      <div className="font-mono text-xl font-semibold tabular-nums text-foreground">{value}</div>
      {caption ? <Caption className="mt-1 block">{caption}</Caption> : null}
    </div>
  );
}
