"use client";

import { useCallback, useEffect, useState } from "react";
import { getTrackerRepository, PersistenceError } from "@/lib/persistence";
import type { TrackerInstance } from "@/lib/platform/tracker-instance";
import type { Ulid } from "@/lib/platform/ids";

interface State {
  status: "loading" | "ready" | "not-found" | "error";
  tracker: TrackerInstance | null;
  errorMessage?: string;
}

/** Single-tracker counterpart to `useTrackerInstances`, for a detail page. */
export function useTrackerInstance(id: Ulid) {
  const [state, setState] = useState<State>({ status: "loading", tracker: null });

  const reload = useCallback(async () => {
    setState((prev) => ({ ...prev, status: "loading" }));
    try {
      const repository = getTrackerRepository();
      const tracker = await repository.getById(id);
      setState(tracker ? { status: "ready", tracker } : { status: "not-found", tracker: null });
    } catch (error) {
      setState({
        status: "error",
        tracker: null,
        errorMessage: error instanceof PersistenceError ? error.message : "Something went wrong loading this tracker.",
      });
    }
  }, [id]);

  useEffect(() => {
    // See the identical comment in use-tracker-instances.ts: loading from
    // IndexedDB on mount is an external-system read that belongs in an
    // effect; the resulting setState happens after an async read, not
    // synchronously in the effect body.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    reload();
  }, [reload]);

  const rename = useCallback(
    async (name: string) => {
      const repository = getTrackerRepository();
      await repository.update(id, { name });
      await reload();
    },
    [id, reload]
  );

  const archive = useCallback(async () => {
    const repository = getTrackerRepository();
    await repository.archive(id);
    await reload();
  }, [id, reload]);

  const restore = useCallback(async () => {
    const repository = getTrackerRepository();
    await repository.restore(id);
    await reload();
  }, [id, reload]);

  const deletePermanently = useCallback(async () => {
    const repository = getTrackerRepository();
    await repository.deletePermanently(id);
  }, [id]);

  return { ...state, rename, archive, restore, deletePermanently, reload };
}
