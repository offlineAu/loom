"use client";

import { useMemo, useState } from "react";
import { CATEGORY_LABELS, CATEGORY_ORDER, TRACKER_CATALOG, type TrackerCategory } from "@/lib/tracker/catalog";
import { TrackerCard } from "@/components/tracker/tracker-card";
import { CategoryNav } from "@/components/tracker/category-nav";
import { SectionTitle } from "@/components/loom/typography";

/** Full tracker catalog browser: category filter + grouped grid of tracker cards. */
export function TrackerGallery() {
  const [active, setActive] = useState<TrackerCategory | "all">("all");

  const categories = useMemo(
    () => (active === "all" ? CATEGORY_ORDER : [active]),
    [active]
  );

  return (
    <div className="space-y-8">
      <CategoryNav active={active} onChange={setActive} />

      {categories.map((category) => {
        const templates = TRACKER_CATALOG.filter((t) => t.category === category);
        return (
          <section key={category} aria-labelledby={`category-${category}`}>
            <SectionTitle id={`category-${category}`} className="mb-3">
              {CATEGORY_LABELS[category]}
            </SectionTitle>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {templates.map((template) => (
                <TrackerCard key={template.key} template={template} />
              ))}
            </div>
          </section>
        );
      })}
    </div>
  );
}
