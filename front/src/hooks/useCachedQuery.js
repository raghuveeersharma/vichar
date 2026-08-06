import { useCallback, useEffect, useRef, useState } from "react";
import { useAuth } from "../context/auth-context";
import {
  onCacheChange,
  readEntry,
  restoreWithheldContent,
  writeEntry,
} from "../libs/cache";
import useOnline from "./useOnline";

// How long a cached copy is treated as the answer, with no request at all. Short
// enough that a note edited in another tab shows up quickly, long enough that
// bouncing home → note → home → folder does not cost four round trips. Every page
// still revalidates in the background once the window passes, so nothing here can
// pin the UI to stale data for longer than the next navigation.
const DEFAULT_STALE_TIME = 30_000;

const EMPTY = {
  data: null,
  loading: true,
  revalidating: false,
  error: null,
  offline: false,
  updatedAt: null,
};

/**
 * Cache-first read of one API resource.
 *
 * The order is always: read the cached copy and render it, then decide whether the
 * network is worth asking. Inside the stale window it is not, which is what stops
 * ordinary navigation from re-requesting lists the user just looked at. Offline it
 * cannot be, so the cached copy is simply the whole answer.
 *
 * `key` is a cache resource name from libs/cache — it is the identity of the
 * query, so changing it (navigating between folders) resets the view, and two
 * components using the same key share the same stored copy.
 *
 * Returns `data` (null until something is known), `loading` (nothing to show yet),
 * `revalidating` (showing a cached copy while refreshing), `error` (the axios
 * error from the last failed fetch — the caller still owns 404/429 handling),
 * `offline`, `stale`, `setData` for optimistic edits, and `refetch`.
 */
export default function useCachedQuery(key, fetcher, options = {}) {
  const {
    staleTime = DEFAULT_STALE_TIME,
    enabled = true,
    // For a resource the API cannot be asked about at all — a note that only
    // exists in the offline queue, whose id the server has never issued. The
    // cached copy is the whole truth, so requesting it could only 404.
    cacheOnly = false,
    onError,
  } = options;
  const { user } = useAuth();
  const owner = user?._id ?? null;
  const online = useOnline();

  const [state, setState] = useState(EMPTY);
  const [tick, setTick] = useState(0);

  // Call sites pass inline closures. Holding them in refs keeps the effect keyed
  // to the cache key alone, instead of re-running on every parent render.
  const fetcherRef = useRef(fetcher);
  fetcherRef.current = fetcher;
  const onErrorRef = useRef(onError);
  onErrorRef.current = onError;

  const scopeRef = useRef(null);
  const forceRef = useRef(false);

  useEffect(() => {
    if (!enabled || !owner || !key) return;
    let cancelled = false;

    // Blank the view only when the resource itself changed — navigating from one
    // folder to another must not show the previous folder's notes under the new
    // name. A background revalidate or a reconnect keeps what is on screen.
    const scope = `${owner}|${key}`;
    if (scopeRef.current !== scope) {
      scopeRef.current = scope;
      setState(EMPTY);
    }

    const force = forceRef.current;
    forceRef.current = false;

    const run = async () => {
      const cached = await readEntry(owner, key);
      if (cancelled) return;

      const fresh = !force && cached && Date.now() - cached.updatedAt < staleTime;
      // `navigator.onLine` is read here rather than using the `online` state so
      // the decision is made against the connection as it is right now, not as it
      // was when this render started.
      const offline = navigator.onLine === false;
      const skipNetwork = Boolean(fresh) || offline || cacheOnly;

      setState((prev) => ({
        data: cached ? cached.data : prev.data,
        // Nothing to render and nothing to wait for is not "loading" — it is the
        // final answer, and the page shows its offline or empty state.
        loading: !cached && prev.data == null && !skipNetwork,
        revalidating: Boolean(cached ?? prev.data) && !skipNetwork,
        error: null,
        offline,
        updatedAt: cached ? cached.updatedAt : prev.updatedAt,
      }));

      if (skipNetwork) return;

      try {
        const data = await fetcherRef.current();
        if (cancelled) return;
        setState({
          data,
          loading: false,
          revalidating: false,
          error: null,
          offline: false,
          updatedAt: Date.now(),
        });
      } catch (error) {
        if (cancelled) return;
        setState((prev) => ({
          ...prev,
          loading: false,
          revalidating: false,
          error,
          offline: navigator.onLine === false,
        }));
        // The page decides what a failure means, and whether it is even worth
        // reporting — a failed background refresh behind a cached list usually is
        // not. `cached` says whether there is anything on screen underneath.
        onErrorRef.current?.(error, { cached: Boolean(cached) });
      }
    };

    run();
    return () => {
      cancelled = true;
    };
    // `online` is a dependency on purpose: regaining a connection re-runs this,
    // which is what makes a page that opened from cache fill itself in.
  }, [owner, key, enabled, staleTime, cacheOnly, online, tick]);

  // The single place anything is written back, so a fetch, a cache read and an
  // optimistic `setData` all persist the same way. The stamp travels with the
  // data rather than being taken here — a patched list is as old as the fetch it
  // came from, and pretending otherwise would extend its stale window.
  useEffect(() => {
    if (!owner || !key) return;
    if (state.data == null || state.updatedAt == null) return;
    writeEntry(owner, key, state.data, state.updatedAt);
  }, [owner, key, state.data, state.updatedAt]);

  // Someone else rewrote this resource — the outbox replacing an optimistic note
  // with the saved one is the case that matters, since it lands under a page that
  // is already open. Re-read from disk; deliberately no request.
  useEffect(() => {
    if (!owner || !key) return;
    return onCacheChange(async (names) => {
      if (!names.includes(key)) return;
      const entry = await readEntry(owner, key);
      setState((prev) => {
        if (!entry) return prev;
        return {
          ...prev,
          // Encrypted bodies are withheld from disk, so a re-read would otherwise
          // downgrade a note this page already holds in plaintext.
          data: restoreWithheldContent(entry.data, prev.data),
          updatedAt: entry.updatedAt,
        };
      });
    });
  }, [owner, key]);

  const setData = useCallback((next) => {
    setState((prev) => ({
      ...prev,
      data: typeof next === "function" ? next(prev.data) : next,
    }));
  }, []);

  const refetch = useCallback(() => {
    forceRef.current = true;
    setTick((t) => t + 1);
  }, []);

  return {
    data: state.data,
    loading: state.loading,
    revalidating: state.revalidating,
    error: state.error,
    offline: state.offline,
    updatedAt: state.updatedAt,
    stale: state.revalidating || (state.offline && state.data != null),
    setData,
    refetch,
  };
}
