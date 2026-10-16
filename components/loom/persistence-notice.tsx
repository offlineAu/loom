"use client";

import { CloudOff } from "lucide-react";
import { usePersistenceAvailability } from "@/lib/persistence/hooks/use-persistence-availability";
import { Caption } from "@/components/loom/typography";

/**
 * Calm, non-alarming notice shown only when local storage genuinely isn't
 * available (Decision D-005) — most visitors never see this. It informs,
 * it doesn't block anything, and it never claims a workaround exists.
 */
export function PersistenceNotice() {
  const status = usePersistenceAvailability();

  if (status !== "unavailable") {
    return null;
  }

  return (
    <div
      role="status"
      className="flex items-center gap-2 border-b border-warning/20 bg-warning/10 px-4 py-2 text-warning"
    >
      <CloudOff className="size-4 shrink-0" aria-hidden="true" />
      <Caption className="text-warning">
        Local storage isn&apos;t available in this browser session — anything you enter here may not
        be saved after this tab closes.
      </Caption>
    </div>
  );
}
