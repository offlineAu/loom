"use client";

import { useState } from "react";
import Link from "next/link";
import { ArchiveRestore, ArrowLeft, Pencil, Trash2 } from "lucide-react";
import { useTrackerInstance } from "@/lib/persistence/hooks/use-tracker-instance";
import { getOwner } from "@/lib/platform/tracker-instance";
import { TrackerNameSheet } from "@/components/tracker/tracker-name-sheet";
import { EmptyState } from "@/components/loom/empty-state";
import { ErrorState } from "@/components/loom/error-state";
import { ConfirmDialog } from "@/components/loom/confirm-dialog";
import { StatusBadge } from "@/components/loom/status-badge";
import { PageTitle, SecondaryText, Caption } from "@/components/loom/typography";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { formatDate } from "@/lib/utils/format";
import { getTemplateByKey } from "@/lib/tracker/catalog";
import type { Ulid } from "@/lib/platform/ids";
import { useRouter } from "next/navigation";

interface TrackerInstanceDetailProps {
  id: Ulid;
  templateKey: string;
  basePath: string;
}

/**
 * Generic tracker instance detail — the Phase 1B persistence proof. Shows
 * only platform-level fields (name, dates, archive state, ownership); no
 * financial domain (balances, payments) exists here yet, by design.
 *
 * Only plain, serializable props (`id`, `templateKey`, `basePath` — all
 * strings) are accepted, since this component's callers include Server
 * Component pages: an icon/component reference cannot cross the
 * Server->Client boundary as a prop. The icon and label are looked up
 * locally from the catalog instead.
 */
export function TrackerInstanceDetail({ id, templateKey, basePath }: TrackerInstanceDetailProps) {
  const template = getTemplateByKey(templateKey);
  const Icon = template?.icon;
  const templateLabel = template?.label ?? templateKey;
  const router = useRouter();
  const { status, tracker, errorMessage, rename, archive, restore, deletePermanently, reload } =
    useTrackerInstance(id);
  const [renameOpen, setRenameOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);

  if (status === "loading") {
    return (
      <div className="space-y-4">
        <Skeleton className="h-8 w-2/3" />
        <Skeleton className="h-24 w-full rounded-xl" />
      </div>
    );
  }

  if (status === "not-found") {
    return (
      <EmptyState
        title="Tracker not found"
        description="It may have been permanently deleted, or the link is incorrect."
        action={
          <Button render={<Link href={basePath} />}>
            Back to {templateLabel}
          </Button>
        }
      />
    );
  }

  if (status === "error" || !tracker) {
    return <ErrorState title="Couldn't load this tracker" description={errorMessage} onRetry={reload} />;
  }

  const owner = getOwner(tracker);
  const isArchived = tracker.archivedAt !== null;

  return (
    <div className="space-y-6">
      <Link href={basePath} className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
        <ArrowLeft className="size-4" aria-hidden="true" />
        Back to {templateLabel}
      </Link>

      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="mb-1 flex flex-wrap items-center gap-2">
            <PageTitle className="text-2xl">{tracker.name}</PageTitle>
            <StatusBadge tone="info">Platform preview</StatusBadge>
            {isArchived ? <StatusBadge tone="neutral">Archived</StatusBadge> : null}
          </div>
          <SecondaryText>
            Created {formatDate(tracker.createdAt)} · Owned {owner?.userId ? "by your account" : "on this device"}
          </SecondaryText>
        </div>
        <Button variant="ghost" size="icon-sm" aria-label="Rename" onClick={() => setRenameOpen(true)}>
          <Pencil className="size-4" aria-hidden="true" />
        </Button>
      </div>

      <EmptyState
        icon={Icon}
        title="Balances and payments arrive in Phase 2"
        description="This instance is really saved on your device — its name, dates, and archive state are persisted through the platform repository. The Debt domain itself (debts, payments, balances) isn't built yet."
      />

      <div className="flex flex-wrap gap-2">
        {isArchived ? (
          <Button variant="outline" onClick={() => restore()}>
            <ArchiveRestore className="size-4" aria-hidden="true" />
            Restore
          </Button>
        ) : (
          <Button variant="outline" onClick={() => archive()}>
            Archive
          </Button>
        )}
        {isArchived ? (
          <Button variant="destructive" onClick={() => setDeleteOpen(true)}>
            <Trash2 className="size-4" aria-hidden="true" />
            Delete permanently
          </Button>
        ) : null}
      </div>

      <Caption>
        Deleting permanently is only offered once a tracker is archived — a later authorization phase
        will decide who is allowed to do this.
      </Caption>

      <TrackerNameSheet
        open={renameOpen}
        onOpenChange={setRenameOpen}
        title="Rename tracker"
        submitLabel="Save"
        initialName={tracker.name}
        onSubmit={rename}
      />

      <ConfirmDialog
        open={deleteOpen}
        onOpenChange={setDeleteOpen}
        title="Delete this tracker permanently?"
        description={`"${tracker.name}" and its data on this device will be permanently removed. This can't be undone.`}
        confirmLabel="Delete permanently"
        destructive
        onConfirm={async () => {
          await deletePermanently();
          router.push(basePath);
        }}
      />
    </div>
  );
}
