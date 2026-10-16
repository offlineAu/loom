"use client";

import { useState } from "react";
import Link from "next/link";
import { Archive, ArchiveRestore, Plus } from "lucide-react";
import { useTrackerInstances } from "@/lib/persistence/hooks/use-tracker-instances";
import { TrackerNameSheet } from "@/components/tracker/tracker-name-sheet";
import { EmptyState } from "@/components/loom/empty-state";
import { ErrorState } from "@/components/loom/error-state";
import { ListSkeleton } from "@/components/loom/loading-skeleton";
import { SectionTitle, Caption } from "@/components/loom/typography";
import { Button } from "@/components/ui/button";
import { formatDate } from "@/lib/utils/format";
import { getTemplateByKey } from "@/lib/tracker/catalog";

interface TrackerInstanceListProps {
  templateKey: string;
  basePath: string;
  defaultName: string;
}

/**
 * Generic list of a user's locally created instances of one tracker
 * template — the Phase 1B persistence proof. Not the Debt Tracker domain:
 * only name/dates/archive state exist here, nothing financial.
 *
 * Only `templateKey` (a plain string) is accepted as a prop, not an icon
 * component or other function — this component's callers include Server
 * Component pages, and a function/component reference can't cross the
 * Server->Client boundary as a prop (only serializable values can). The
 * icon and label are looked up locally from the catalog instead.
 */
export function TrackerInstanceList({ templateKey, basePath, defaultName }: TrackerInstanceListProps) {
  const template = getTemplateByKey(templateKey);
  const Icon = template?.icon;
  const templateLabel = template?.label ?? templateKey;
  const [createOpen, setCreateOpen] = useState(false);
  const { status, trackers, errorMessage, create, archive, restore, reload } = useTrackerInstances(
    templateKey,
    { includeArchived: true }
  );

  if (status === "loading") {
    return <ListSkeleton rows={3} />;
  }

  if (status === "error") {
    return <ErrorState title="Couldn't load your trackers" description={errorMessage} onRetry={reload} />;
  }

  const active = trackers.filter((t) => t.archivedAt === null);
  const archived = trackers.filter((t) => t.archivedAt !== null);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <SectionTitle className="text-base font-medium">Your {templateLabel} instances</SectionTitle>
        <Button size="sm" onClick={() => setCreateOpen(true)}>
          <Plus className="size-4" aria-hidden="true" />
          New
        </Button>
      </div>

      {active.length === 0 && archived.length === 0 ? (
        <EmptyState
          icon={Icon}
          title={`No ${templateLabel} yet on this device`}
          description="Create one to try the persistence layer — it's saved locally, instantly, with no account required."
          action={<Button onClick={() => setCreateOpen(true)}>Create your first one</Button>}
        />
      ) : (
        <ul className="space-y-2">
          {active.map((tracker) => (
            <li
              key={tracker.id}
              className="flex items-center justify-between gap-3 rounded-lg border border-border bg-card p-3 shadow-sm"
            >
              <Link href={`${basePath}/${tracker.id}`} className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium text-foreground">{tracker.name}</p>
                <Caption>Created {formatDate(tracker.createdAt)}</Caption>
              </Link>
              <Button
                variant="ghost"
                size="icon-sm"
                aria-label={`Archive ${tracker.name}`}
                onClick={() => archive(tracker.id)}
              >
                <Archive className="size-4" aria-hidden="true" />
              </Button>
            </li>
          ))}
        </ul>
      )}

      {archived.length > 0 ? (
        <div className="space-y-2">
          <Caption>Archived</Caption>
          <ul className="space-y-2">
            {archived.map((tracker) => (
              <li
                key={tracker.id}
                className="flex items-center justify-between gap-3 rounded-lg border border-dashed border-border bg-muted/40 p-3 opacity-80"
              >
                <Link href={`${basePath}/${tracker.id}`} className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium text-muted-foreground">{tracker.name}</p>
                  <Caption>Archived {formatDate(tracker.archivedAt as string)}</Caption>
                </Link>
                <Button
                  variant="ghost"
                  size="icon-sm"
                  aria-label={`Restore ${tracker.name}`}
                  onClick={() => restore(tracker.id)}
                >
                  <ArchiveRestore className="size-4" aria-hidden="true" />
                </Button>
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      <TrackerNameSheet
        open={createOpen}
        onOpenChange={setCreateOpen}
        title={`New ${templateLabel}`}
        description="Give it a name you'll recognize. You can rename it later."
        submitLabel="Create"
        initialName={defaultName}
        onSubmit={create}
      />
    </div>
  );
}
