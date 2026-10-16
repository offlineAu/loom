"use client";

import { UserCircle } from "lucide-react";
import { useSession } from "@/lib/auth/hooks/use-session";
import { SignInForm } from "@/components/account/sign-in-form";
import { CloudTrackerPoc } from "@/components/account/cloud-tracker-poc";
import { EmptyState } from "@/components/loom/empty-state";
import { ListSkeleton } from "@/components/loom/loading-skeleton";
import { SecondaryText, Caption } from "@/components/loom/typography";
import { Button } from "@/components/ui/button";

/**
 * Everything the account page renders beyond its static header. A Client
 * Component (unlike the Phase 1A/1B placeholder) because it needs
 * `useSession()` — the page itself stays a Server Component for `metadata`.
 */
export function AccountPanel() {
  const session = useSession();

  if (session.status === "loading") {
    return <ListSkeleton rows={2} />;
  }

  if (session.status === "unconfigured") {
    return (
      <EmptyState
        icon={UserCircle}
        title="Cloud accounts aren't set up for this deployment"
        description="No Supabase project is configured here, so sign-in is unavailable — but everything you track stays saved on this device either way."
        action={<Button disabled>Sign in</Button>}
      />
    );
  }

  if (session.status === "signed-out") {
    return (
      <div className="space-y-4">
        <SecondaryText>
          Signing in backs up your trackers to the cloud and lets you use them on another
          device. It&apos;s entirely optional — everything here already works without it.
        </SecondaryText>
        <SignInForm onSignIn={session.signInWithOtp} />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between rounded-lg border border-border bg-card p-4">
        <div>
          <p className="text-sm font-medium text-foreground">
            {session.profile?.display_name || session.user.email}
          </p>
          <Caption>{session.user.email}</Caption>
        </div>
        <Button variant="outline" size="sm" onClick={session.signOut}>
          Sign out
        </Button>
      </div>
      <CloudTrackerPoc />
    </div>
  );
}
