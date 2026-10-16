"use client";

import { useCallback, useEffect, useState } from "react";
import { getCloudTrackerRepository, PersistenceError } from "@/lib/persistence/cloud";
import type { TrackerInstance } from "@/lib/platform/tracker-instance";
import type { Ulid } from "@/lib/platform/ids";

interface State {
  status: "loading" | "ready" | "error";
  trackers: TrackerInstance[];
  errorMessage?: string;
}

/**
 * Cloud counterpart to `useTrackerInstances` (Phase 1B). Only meant to be
 * mounted while `useSession()` reports `"signed-in"` — the account page's
 * cloud tracker proof-of-concept panel is the only current caller. This is
 * a platform proof, not the real Debt Tracker: `templateKey` here is a
 * neutral value ("cloud-preview"), never Debt-domain data.
 */
export function useCloudTrackerInstances(templateKey: string) {
  const [state, setState] = useState<State>({ status: "loading", trackers: [] });

  const reload = useCallback(async () => {
    setState((prev) => ({ ...prev, status: "loading" }));
    try {
      const repository = getCloudTrackerRepository();
      const trackers = await repository.list({ templateKey, includeArchived: true });
      setState({ status: "ready", trackers });
    } catch (error) {
      setState({
        status: "error",
        trackers: [],
        errorMessage: error instanceof PersistenceError ? error.message : "Something went wrong loading your cloud trackers.",
      });
    }
  }, [templateKey]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    reload();
  }, [reload]);

  const create = useCallback(
    async (name: string) => {
      const repository = getCloudTrackerRepository();
      await repository.create({ templateKey, name });
      await reload();
    },
    [templateKey, reload]
  );

  const archive = useCallback(
    async (id: Ulid) => {
      const repository = getCloudTrackerRepository();
      await repository.archive(id);
      await reload();
    },
    [reload]
  );

  const restore = useCallback(
    async (id: Ulid) => {
      const repository = getCloudTrackerRepository();
      await repository.restore(id);
      await reload();
    },
    [reload]
  );

  const deletePermanently = useCallback(
    async (id: Ulid) => {
      const repository = getCloudTrackerRepository();
      await repository.deletePermanently(id);
      await reload();
    },
    [reload]
  );

  return { ...state, create, archive, restore, deletePermanently, reload };
}
