import type { Metadata } from "next";
import { PageTitle, SecondaryText } from "@/components/loom/typography";
import { StatusBadge } from "@/components/loom/status-badge";
import { TrackerInstanceList } from "@/components/tracker/tracker-instance-list";

export const metadata: Metadata = {
  title: "Debt Tracker",
  description: "Track balances, payments, and payoff progress for every debt in one place.",
};

/**
 * Debt Tracker entry point. This is the Phase 1B persistence proof, not the
 * real Debt Tracker: instances you create here are genuinely saved to this
 * device (name, dates, archive state) through the platform repository, but
 * no debts/payments/balances exist yet — that domain is Phase 2.
 */
export default function DebtTrackerEntryPage() {
  return (
    <div className="space-y-6">
      <div>
        <div className="mb-1 flex items-center gap-2">
          <PageTitle className="text-2xl">Debt Tracker</PageTitle>
          <StatusBadge tone="info">Platform preview</StatusBadge>
        </div>
        <SecondaryText>
          Track balances, payments, and payoff progress for every debt in one place.
        </SecondaryText>
      </div>

      <TrackerInstanceList templateKey="debt" basePath="/trackers/debt" defaultName="My Debt Tracker" />
    </div>
  );
}
