import { useCallback, useEffect, useRef, useState } from "react";
import toast from "react-hot-toast";
import { CloudOffIcon, RefreshCwIcon, UploadCloudIcon } from "lucide-react";
import { useAuth } from "../context/auth-context";
import useOnline from "../hooks/useOnline";
import { countQueued, onQueueChange } from "../libs/outbox";
import { flushOutbox } from "../libs/notes";

/**
 * The connectivity bar, and the thing that actually sends the offline queue.
 *
 * Mounted once above the routes rather than per page, because a reconnect has to be
 * noticed wherever the user happens to be — and because the toast that reports the
 * result would otherwise be unmounted by the navigation that often follows.
 */
const SyncStatus = () => {
  const { user } = useAuth();
  const owner = user?._id;
  const online = useOnline();

  const [pending, setPending] = useState(0);
  const [syncing, setSyncing] = useState(false);
  // Guards against two flushes overlapping — the same request sent twice would
  // create the same note twice.
  const busy = useRef(false);

  useEffect(() => {
    if (!owner) {
      setPending(0);
      return;
    }
    let alive = true;
    const refresh = async () => {
      const count = await countQueued(owner);
      if (alive) setPending(count);
    };
    refresh();
    const unsubscribe = onQueueChange(refresh);
    return () => {
      alive = false;
      unsubscribe();
    };
  }, [owner]);

  const sync = useCallback(async () => {
    if (!owner || busy.current) return;
    busy.current = true;
    setSyncing(true);
    try {
      const { sent, dropped, remaining } = await flushOutbox(owner);
      if (sent) {
        toast.success(
          sent === 1 ? "1 change synced" : `${sent} changes synced`
        );
      }
      if (dropped) {
        // These were rejected outright — the note was deleted elsewhere, or its
        // folder is gone. Saying so is the only honest option; the edit is lost.
        toast.error(
          dropped === 1
            ? "1 change could not be saved and was discarded"
            : `${dropped} changes could not be saved and were discarded`,
          { duration: 8000 }
        );
      }
      if (remaining) {
        // Stopped on something retryable, so the queue is still intact. The bar
        // below keeps offering the retry.
        toast.error("Could not finish syncing — will try again");
      }
    } finally {
      busy.current = false;
      setSyncing(false);
      setPending(await countQueued(owner));
    }
  }, [owner]);

  // Fires on mount when there is already a connection, and on every
  // offline → online flip. Deliberately not keyed on `pending`: a flush that
  // stopped on a retryable failure would then immediately re-run itself, which is
  // a request loop rather than a retry. That case is the button below.
  useEffect(() => {
    if (!owner || !online) return;
    sync();
  }, [owner, online, sync]);

  if (!owner) return null;
  if (online && pending === 0) return null;

  return (
    <div className="mx-auto mt-3 max-w-6xl px-3 sm:px-4">
      <div className="glass-panel flex flex-wrap items-center gap-x-3 gap-y-1 px-4 py-2 text-sm">
        {online ? (
          <UploadCloudIcon className="size-4 shrink-0 text-primary" />
        ) : (
          <CloudOffIcon className="size-4 shrink-0 text-base-content/60" />
        )}
        <span className="text-base-content/80">
          {online
            ? syncing
              ? "Syncing your changes..."
              : `${pending} ${pending === 1 ? "change" : "changes"} waiting to sync`
            : "You're offline — showing your saved notes"}
        </span>
        {!online && pending > 0 && (
          <span className="text-base-content/60">
            {pending} {pending === 1 ? "change" : "changes"} will be sent when
            you reconnect
          </span>
        )}
        {online && pending > 0 && !syncing && (
          <button
            className="btn btn-ghost btn-xs gap-1"
            onClick={sync}
            type="button"
          >
            <RefreshCwIcon className="size-3" />
            retry
          </button>
        )}
      </div>
    </div>
  );
};

export default SyncStatus;
