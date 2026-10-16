import { describe, expect, it } from "vitest";
import {
  CATEGORY_ORDER,
  TRACKER_CATALOG,
  getTemplateByKey,
  getTrackersByCategory,
} from "@/lib/tracker/catalog";

describe("tracker catalog", () => {
  it("marks Debt Tracker as the only available template", () => {
    const available = TRACKER_CATALOG.filter((t) => t.status === "available");
    expect(available).toHaveLength(1);
    expect(available[0].key).toBe("debt");
    expect(available[0].href).toBe("/trackers/debt");
  });

  it("gives every coming-soon template no href", () => {
    for (const template of TRACKER_CATALOG.filter((t) => t.status === "coming-soon")) {
      expect(template.href).toBeUndefined();
    }
  });

  it("has at least one template in every category", () => {
    for (const category of CATEGORY_ORDER) {
      expect(getTrackersByCategory(category).length).toBeGreaterThan(0);
    }
  });

  it("looks up a template by key", () => {
    expect(getTemplateByKey("debt")?.label).toBe("Debt Tracker");
    expect(getTemplateByKey("does-not-exist")).toBeUndefined();
  });

  it("has unique keys across the whole catalog", () => {
    const keys = TRACKER_CATALOG.map((t) => t.key);
    expect(new Set(keys).size).toBe(keys.length);
  });
});
