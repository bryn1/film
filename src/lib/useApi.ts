/**
 * useApi.ts — the client-side fetch hook for the /api envelope (one data
 * mechanism for the whole app; components never fetch TMDB directly).
 * One AbortController per request: unmount, url change or retry() cancels
 * the in-flight request instead of racing it.
 * basePath does NOT rewrite manual fetch() calls, so the /film prefix rides
 * in on BASE — the SAME build-time env as next.config.mjs's basePath (the
 * only two files the prefix touches, MC 10444). Unset ⇒ "" ⇒ unprefixed.
 */

"use client";

import { useCallback, useEffect, useState } from "react";
import type { ApiEnvelope } from "./tmdb/types";

export interface UseApiResult<T> {
  data: T | null;
  loading: boolean;
  error: string | null;
  retry: () => void;
}

/** Fallback shown when the request itself fails (network/server, not a coded envelope error). */
const NETWORK_ERROR_MESSAGE = "Kunde inte nå filmdatabasen";

/** Build-time route prefix ("/film" on the hosted copy; "" in dev/tests). */
const BASE = process.env.NEXT_PUBLIC_BASE_PATH || "";

export function useApi<T>(url: string): UseApiResult<T> {
  const [data, setData] = useState<T | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [reloadKey, setReloadKey] = useState(0);

  const retry = useCallback(() => setReloadKey((key) => key + 1), []);

  useEffect(() => {
    const controller = new AbortController();
    let active = true;
    setLoading(true);
    setError(null);

    (async () => {
      try {
        const response = await fetch(BASE + url, { signal: controller.signal });
        const envelope = (await response.json()) as ApiEnvelope<T>;
        if (!active) {
          return;
        }
        if (envelope.ok) {
          setData(envelope.data);
        } else {
          setData(null);
          setError(envelope.error.message);
        }
      } catch {
        if (!active) {
          return;
        }
        setData(null);
        setError(NETWORK_ERROR_MESSAGE);
      } finally {
        if (active) {
          setLoading(false);
        }
      }
    })();

    return () => {
      active = false;
      controller.abort();
    };
  }, [url, reloadKey]);

  return { data, loading, error, retry };
}
