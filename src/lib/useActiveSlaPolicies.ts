import { useEffect, useState } from "react";
import { fetchAllPages } from "../api/paging";
import { settingsApi } from "../api/settings";
import type { SlaPolicy, SlaPolicyType } from "../types/settings";
import { sortSlaPolicies } from "./slaPolicyUi";

type CacheEntry = {
  data: SlaPolicy[] | null;
  promise: Promise<SlaPolicy[]> | null;
};

const cache = new Map<SlaPolicyType, CacheEntry>();
let prefetchStarted = false;

function loadActiveSlaPolicies(type: SlaPolicyType): Promise<SlaPolicy[]> {
  const hit = cache.get(type);
  if (hit?.data) return Promise.resolve(hit.data);
  if (hit?.promise) return hit.promise;

  const promise = fetchAllPages<SlaPolicy>((page, pageSize) =>
    settingsApi.slaPolicies.list({ page, pageSize, status: "activas", type }),
  )
    .then((items) => {
      const sorted = sortSlaPolicies(items);
      cache.set(type, { data: sorted, promise });
      return sorted;
    })
    .catch((err) => {
      cache.delete(type);
      throw err;
    });

  cache.set(type, { data: null, promise });
  return promise;
}

/** Precarga Ticket y Tarea en segundo plano (una sola vez por sesión). */
export function prefetchActiveSlaPolicies() {
  if (prefetchStarted) return;
  prefetchStarted = true;
  void loadActiveSlaPolicies("Ticket").catch(() => {});
  void loadActiveSlaPolicies("Tarea").catch(() => {});
}

export function invalidateActiveSlaPoliciesCache(type?: SlaPolicyType) {
  if (type) cache.delete(type);
  else cache.clear();
}

export function useActiveSlaPolicies(type: SlaPolicyType) {
  const cached = cache.get(type)?.data ?? null;
  const [policies, setPolicies] = useState<SlaPolicy[] | null>(cached);
  const [loading, setLoading] = useState(!cached);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    prefetchActiveSlaPolicies();
  }, []);

  useEffect(() => {
    let cancelled = false;
    const warm = cache.get(type)?.data;
    if (warm) {
      setPolicies(warm);
      setLoading(false);
      setFailed(false);
      return;
    }

    setLoading(true);
    loadActiveSlaPolicies(type)
      .then((items) => {
        if (cancelled) return;
        setPolicies(items);
        setFailed(false);
      })
      .catch(() => {
        if (!cancelled) {
          setPolicies([]);
          setFailed(true);
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [type]);

  return { policies, loading, failed };
}
