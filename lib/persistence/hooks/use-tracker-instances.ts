"use client";

import { useCallback, useEffect, useState } from "react";
import { getTrackerRepository, PersistenceError } from "@/lib/persistence";
import type { TrackerInstance } from "@/lib/platform/tracker-instance";
import type { Ulid } from "@/lib/platform/ids";

interface State {
  status: "loading" | "ready" | "error";
  trackers: TrackerInstance[];
  errorMessage?: string;
}

/**
 * The one place components go to list/create/archive/restore/delete tracker
 * instances of a given template. Components never import a repository or
 * Dexie directly — this hook is the seam.
 */
export function useTrackerInstances(templateKey: string, options: { includeArchived?: boolean } = {}) {
  const { includeArchived = false } = options;
  const [state, setState] = useState<State>({ status: "loading", trackers: [] });

  const reload = useCallback(async () => {
    setState((prev) => ({ ...prev, status: "loading" }));
    try {
      const repository = getTrackerRepository();
      const trackers = await repository.list({ templateKey, includeArchived });
      setState({ status: "ready", trackers });
    } catch (error) {
      setState({
        status: "error",
        trackers: [],
        errorMessage: error instanceof PersistenceError ? error.message : "Something went wrong loading your trackers.",
      });
    }
  }, [templateKey, includeArchived]);

  useEffect(() => {
    // Loading persisted state from IndexedDB on mount is an external-system
    // read, not something derivable from existing props/state — an effect
    // is the correct place for it, and the resulting setState is
    // necessarily asynchronous (after the read completes), not a
    // synchronous cascade.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    reload();
  }, [reload]);

  const create = useCallback(
    async (name: string) => {
      const repository = getTrackerRepository();
      await repository.create({ templateKey, name });
      await reload();
    },
    [templateKey, reload]
  );

  const archive = useCallback(
    async (id: Ulid) => {
      const repository = getTrackerRepository();
      await repository.archive(id);
      await reload();
    },
    [reload]
  );

  const restore = useCallback(
    async (id: Ulid) => {
      const repository = getTrackerRepository();
      await repository.restore(id);
      await reload();
    },
    [reload]
  );

  const deletePermanently = useCallback(
    async (id: Ulid) => {
      const repository = getTrackerRepository();
      await repository.deletePermanently(id);
      await reload();
    },
    [reload]
  );

  return { ...state, create, archive, restore, deletePermanently, reload };
}
