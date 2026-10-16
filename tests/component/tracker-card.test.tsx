import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import { TrackerCard } from "@/components/tracker/tracker-card";
import { getTemplateByKey } from "@/lib/tracker/catalog";

describe("TrackerCard", () => {
  it("renders an available template as a link with an Available badge", () => {
    const debt = getTemplateByKey("debt")!;
    render(<TrackerCard template={debt} />);

    expect(screen.getByText("Debt Tracker")).toBeInTheDocument();
    expect(screen.getByText("Available")).toBeInTheDocument();
    expect(screen.getByRole("link")).toHaveAttribute("href", "/trackers/debt");
  });

  it("renders a coming-soon template as disabled, not a link", () => {
    const savings = getTemplateByKey("savings")!;
    render(<TrackerCard template={savings} />);

    expect(screen.getByText("Savings Tracker")).toBeInTheDocument();
    expect(screen.getByText("Coming soon")).toBeInTheDocument();
    expect(screen.queryByRole("link")).not.toBeInTheDocument();
  });
});
