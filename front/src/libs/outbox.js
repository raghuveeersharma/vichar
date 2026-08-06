import { OUTBOX_STORE, withStore } from "./idb";

// The queue of note writes made with no connection, replayed in order once there
// is one. Storage only — the requests themselves live in libs/notes.js, so there
// is still exactly one place that knows how a note is saved.
//
// Order is insertion order, which is why the store auto-increments its key: an
// update queued after a create has to be applied after it. Nothing here retries or
// schedules anything; the queue is inert until something calls the flush.

export const CREATE = "note:create";
export const UPDATE = "note:update";
export const DELETE = "note:delete";

// A note that exists only in this browser. The prefix is what tells every other
// code path that this id was never issued by the server, so it must not be sent
// in a URL and it will be replaced when the create is finally accepted.
const LOCAL_PREFIX = "local:";

export const newLocalId = () =>
  `${LOCAL_PREFIX}${
    // Available in every secure context, which a PWA already has to be. The
    // fallback only matters when the app is served over plain http in dev.
    crypto.randomUUID?.() ?? `${Date.now()}-${Math.random().toString(16).slice(2)}`
  }`;

export const isLocalId = (id) =>
  typeof id === "string" && id.startsWith(LOCAL_PREFIX);

// The pending count drives a badge, so the UI has to hear about changes rather
// than poll for them.
const listeners = new Set();

export function onQueueChange(listener) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

function announce() {
  for (const listener of listeners) {
    try {
      listener();
    } catch (error) {
      console.warn("Outbox listener failed:", error);
    }
  }
}

/** Appends an item. Returns its id, or null if the queue is unavailable. */
export async function enqueue(owner, item) {
  const id = await withStore(OUTBOX_STORE, "readwrite", (store, asPromise) =>
    asPromise(store.add({ ...item, owner, queuedAt: Date.now() }))
  );
  announce();
  return id ?? null;
}

/** This owner's queued writes, oldest first. */
export async function listQueue(owner) {
  if (!owner) return [];
  const items = await withStore(
    OUTBOX_STORE,
    "readonly",
    (store, asPromise) => asPromise(store.index("owner").getAll(owner)),
    []
  );
  return (items ?? []).sort((a, b) => a.id - b.id);
}

export async function countQueued(owner) {
  return (await listQueue(owner)).length;
}

/** Replaces an item in place, keeping its id and therefore its position. */
export async function replaceItem(item) {
  await withStore(OUTBOX_STORE, "readwrite", (store) => store.put(item));
  announce();
}

export async function removeItem(id) {
  await withStore(OUTBOX_STORE, "readwrite", (store) => store.delete(id));
  announce();
}
