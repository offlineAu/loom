import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import { CreditCard } from "lucide-react";
import { EmptyState } from "@/components/loom/empty-state";

describe("EmptyState", () => {
  it("renders a title and description", () => {
    render(
      <EmptyState
        icon={CreditCard}
        title="Nothing here yet"
        description="Add your first item to get started."
      />
    );

    expect(screen.getByText("Nothing here yet")).toBeInTheDocument();
    expect(screen.getByText("Add your first item to get started.")).toBeInTheDocument();
  });

  it("renders an action when provided", () => {
    render(<EmptyState title="Empty" action={<button>Do something</button>} />);
    expect(screen.getByRole("button", { name: "Do something" })).toBeInTheDocument();
  });
});
