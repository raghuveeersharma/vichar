// The one place that talks to IndexedDB. Two stores share a single database so
// there is only ever one connection and one version to migrate:
//
//   entries — cached API responses, keyed by owner + resource name
//   outbox  — writes made while offline, replayed on reconnect
//
// Everything here is fail-soft on purpose. IndexedDB is unavailable in Firefox's
// private windows, can be evicted under storage pressure, and throws on some
// locked-down iOS configurations. A cache that cannot be opened has to degrade
// into "no cache", never into a broken app — so every helper resolves to a
// fallback instead of rejecting, and the caller writes no error handling.

const DB_NAME = "vichar";
const DB_VERSION = 1;

export const ENTRY_STORE = "entries";
export const OUTBOX_STORE = "outbox";

function open() {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(ENTRY_STORE)) {
        // `key` is already "<owner>|<name>", so the owner index exists only to
        // sweep or invalidate one user's entries without scanning the store.
        const entries = db.createObjectStore(ENTRY_STORE, { keyPath: "key" });
        entries.createIndex("owner", "owner");
      }
      if (!db.objectStoreNames.contains(OUTBOX_STORE)) {
        // Auto-increment because replay order is insertion order: an update that
        // follows a create has to be applied after it.
        const outbox = db.createObjectStore(OUTBOX_STORE, {
          keyPath: "id",
          autoIncrement: true,
        });
        outbox.createIndex("owner", "owner");
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
    // Another tab holds an older version open. Treat it as "no cache" rather
    // than hanging forever on a promise that may never settle.
    request.onblocked = () => reject(new Error("IndexedDB upgrade blocked"));
  });
}

// Resolved once and reused, including when opening failed — the `undefined`
// check (not a falsy check) is what keeps a permanently broken IndexedDB from
// being reopened on every single read.
let dbPromise;

function getDb() {
  if (dbPromise === undefined) {
    dbPromise = (
      typeof indexedDB === "undefined"
        ? Promise.reject(new Error("IndexedDB unavailable"))
        : open()
    ).catch((error) => {
      console.warn("Offline cache disabled:", error);
      return null;
    });
  }
  return dbPromise;
}

/** Wraps an IDBRequest as a promise. */
export function asPromise(request) {
  return new Promise((resolve, reject) => {
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

/**
 * Runs `work(store, asPromise)` inside one transaction and resolves once the
 * transaction commits, or resolves `fallback` if anything at all went wrong.
 *
 * `work` may await its own requests: promise callbacks run as microtasks, which
 * is still the same event-loop turn, so the transaction is alive across an
 * `await` on a request issued inside it. Awaiting anything else (a fetch, a
 * timer) would let it auto-commit — keep `work` purely IndexedDB.
 */
export async function withStore(name, mode, work, fallback = null) {
  const db = await getDb();
  if (!db) return fallback;
  try {
    const tx = db.transaction(name, mode);
    // Attached before `work` runs, so a transaction that finishes inside it
    // cannot complete before anyone is listening.
    const committed = new Promise((resolve, reject) => {
      tx.oncomplete = () => resolve();
      tx.onabort = () => reject(tx.error ?? new Error("transaction aborted"));
      tx.onerror = () => reject(tx.error ?? new Error("transaction failed"));
    });
    const result = await work(tx.objectStore(name), asPromise);
    await committed;
    return result;
  } catch (error) {
    console.warn(`Offline cache ${mode} on "${name}" failed:`, error);
    return fallback;
  }
}

/** Wipes both stores — used on logout, where nothing may outlive the session. */
export async function destroyAll() {
  await Promise.all([
    withStore(ENTRY_STORE, "readwrite", (store) => store.clear()),
    withStore(OUTBOX_STORE, "readwrite", (store) => store.clear()),
  ]);
}
