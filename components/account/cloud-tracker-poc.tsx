"use client";

import { useState } from "react";
import { Archive, ArchiveRestore, Plus, Trash2 } from "lucide-react";
import { useCloudTrackerInstances } from "@/lib/persistence/cloud/hooks/use-cloud-tracker-instances";
import { TrackerNameSheet } from "@/components/tracker/tracker-name-sheet";
import { ErrorState } from "@/components/loom/error-state";
import { ListSkeleton } from "@/components/loom/loading-skeleton";
import { SectionTitle, Caption } from "@/components/loom/typography";
import { Button } from "@/components/ui/button";
import { formatDate } from "@/lib/utils/format";

const CLOUD_PREVIEW_TEMPLATE_KEY = "cloud-preview";

/**
 * Platform proof, not a product feature: demonstrates the Supabase-backed
 * repository (create/read/update/archive/restore/delete, all through
 * `TrackerRepository`, never a direct `supabase.from(...)` call from this
 * component) end to end for a signed-in user. No Debt-domain fields exist
 * here — only name + archive state, exactly like Phase 1B's local
 * proof-of-concept.
 */
export function CloudTrackerPoc() {
  const [createOpen, setCreateOpen] = useState(false);
  const { status, trackers, errorMessage, create, archive, restore, deletePermanently, reload } =
    useCloudTrackerInstances(CLOUD_PREVIEW_TEMPLATE_KEY);

  return (
    <div className="space-y-4 rounded-lg border border-border bg-card p-4">
      <div className="flex items-center justify-between">
        <div>
          <SectionTitle className="text-base font-medium">Cloud tracker (preview)</SectionTitle>
          <Caption>Stored in Supabase under your account — a platform proof, not a real tracker type yet.</Caption>
        </div>
        <Button size="sm" onClick={() => setCreateOpen(true)}>
          <Plus className="size-4" aria-hidden="true" />
          New
        </Button>
      </div>

      {status === "loading" ? <ListSkeleton rows={2} /> : null}
      {status === "error" ? <ErrorState title="Couldn't load your cloud trackers" description={errorMessage} onRetry={reload} /> : null}

      {status === "ready" && trackers.length === 0 ? (
        <p className="text-sm text-muted-foreground">No cloud trackers yet — create one to try it out.</p>
      ) : null}

      {status === "ready" && trackers.length > 0 ? (
        <ul className="space-y-2">
          {trackers.map((tracker) => (
            <li
              key={tracker.id}
              className="flex items-center justify-between gap-3 rounded-lg border border-border p-3"
            >
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium text-foreground">{tracker.name}</p>
                <Caption>
                  {tracker.archivedAt
                    ? `Archived ${formatDate(tracker.archivedAt)}`
                    : `Created ${formatDate(tracker.createdAt)}`}
                </Caption>
              </div>
              {tracker.archivedAt ? (
                <div className="flex gap-1">
                  <Button
                    variant="ghost"
                    size="icon-sm"
                    aria-label={`Restore ${tracker.name}`}
                    onClick={() => restore(tracker.id)}
                  >
                    <ArchiveRestore className="size-4" aria-hidden="true" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon-sm"
                    aria-label={`Delete ${tracker.name} permanently`}
                    onClick={() => deletePermanently(tracker.id)}
                  >
                    <Trash2 className="size-4" aria-hidden="true" />
                  </Button>
                </div>
              ) : (
                <Button
                  variant="ghost"
                  size="icon-sm"
                  aria-label={`Archive ${tracker.name}`}
                  onClick={() => archive(tracker.id)}
                >
                  <Archive className="size-4" aria-hidden="true" />
                </Button>
              )}
            </li>
          ))}
        </ul>
      ) : null}

      <TrackerNameSheet
        open={createOpen}
        onOpenChange={setCreateOpen}
        title="New cloud tracker"
        description="Give it a name. It's saved to your account, not just this device."
        submitLabel="Create"
        initialName="My Cloud Tracker"
        onSubmit={create}
      />
    </div>
  );
}
