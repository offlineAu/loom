"use client";

import { cn } from "cn";
import { CATEGORY_LABELS, CATEGORY_ORDER, type TrackerCategory } from "@/lib/tracker/catalog";

interface CategoryNavProps {
  active: TrackerCategory | "all";
  onChange: (category: TrackerCategory | "all") => void;
}

/** Simple tab-style category filter for the tracker gallery. */
export function CategoryNav({ active, onChange }: CategoryNavProps) {
  const options: Array<{ key: TrackerCategory | "all"; label: string }> = [
    { key: "all", label: "All" },
    ...CATEGORY_ORDER.map((key) => ({ key, label: CATEGORY_LABELS[key] })),
  ];

  return (
    <div role="tablist" aria-label="Tracker categories" className="flex flex-wrap gap-2">
      {options.map((option) => {
        const isActive = option.key === active;
        return (
          <button
            key={option.key}
            type="button"
            role="tab"
            aria-selected={isActive}
            onClick={() => onChange(option.key)}
            className={cn(
              "rounded-full px-3 py-1.5 text-sm font-medium transition-colors",
              isActive
                ? "bg-primary text-primary-foreground"
                : "bg-muted text-muted-foreground hover:bg-accent hover:text-accent-foreground"
            )}
          >
            {option.label}
          </button>
        );
      })}
    </div>
  );
}
