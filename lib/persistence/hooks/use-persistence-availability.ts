"use client";

import { useEffect, useState } from "react";
import { checkPersistenceAvailability, type PersistenceAvailability } from "@/lib/persistence";

/**
 * Runs the availability check once on mount. Components use this to decide
 * whether to show a (calm, non-alarming) notice that local storage isn't
 * available in this browser session — see `components/loom/persistence-notice.tsx`.
 */
export function usePersistenceAvailability(): PersistenceAvailability {
  const [status, setStatus] = useState<PersistenceAvailability>("unknown");

  useEffect(() => {
    let cancelled = false;
    checkPersistenceAvailability().then((result) => {
      if (!cancelled) {
        setStatus(result.status);
      }
    });
    return () => {
      cancelled = true;
    };
  }, []);

  return status;
}
