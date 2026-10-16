import type { Metadata } from "next";
import { PageTitle } from "@/components/loom/typography";
import { AccountPanel } from "@/components/account/account-panel";

export const metadata: Metadata = {
  title: "Account",
  description: "Optional LOOM account — sign in to back up and sync your trackers.",
};

/**
 * Account entry point. Authentication is optional (D-004): every state
 * `AccountPanel` renders is honest about whether cloud sign-in is actually
 * available in this deployment, and local/anonymous usage never depends on
 * anything here.
 */
export default function AccountPage() {
  return (
    <div className="space-y-6">
      <PageTitle className="text-2xl">Account</PageTitle>
      <AccountPanel />
    </div>
  );
}
