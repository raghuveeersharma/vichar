import { ENTRY_STORE, destroyAll, withStore } from "./idb";

// The read cache: one IndexedDB record per API response the app wants to survive
// a reload. Two jobs, and they are the same mechanism — stop re-requesting a list
// the user just looked at, and have something to render when there is no network.
//
// This lives in app state rather than in the service worker's Cache API, which is
// deliberate: a cached *response* would be replayed to whoever holds the tab next,
// outliving the cookie that authorised it. An entry here is stamped with the owner
// it was fetched for, is only ever read back for that same owner, and is destroyed
// on logout.

// Resource names. `notes:<folder>` mirrors the API's own `?folder=` vocabulary,
// including the literal "unfiled", so a route param maps straight to a cache key.
export const NOTES_ALL = "notes:all";
export const notesKey = (folder) => (folder ? `notes:${folder}` : NOTES_ALL);
export const noteKey = (id) => `note:${id}`;
export const FOLDERS = "folders";

const NOTE_LIST_PREFIX = "notes:";

const recordKey = (owner, name) => `${owner}|${name}`;

// ---------------------------------------------------------------------------
// What is allowed onto disk
// ---------------------------------------------------------------------------

// An encrypted note's body only arrives as plaintext because the server opened it
// for this one response; the key is server-side and the client has no way to seal
// it again. Writing that plaintext into IndexedDB would leave the note readable on
// disk — the exact outcome the user chose encryption to avoid — so the body is
// dropped and `contentCached: false` marks it as withheld rather than empty.
// NoteCard and NoteDetailPage branch on that flag instead of showing a blank note.
function forStorage(value) {
  if (Array.isArray(value)) return value.map(forStorage);
  if (value && typeof value === "object" && value.isEncrypted) {
    return { ...value, content: "", contentCached: false };
  }
  return value;
}

/**
 * The inverse of what `forStorage` took away, for the one case where it matters:
 * a component holding freshly fetched notes re-reads its entry because something
 * else patched the list, and the copy coming back off disk has the encrypted
 * bodies stripped. Without this, deleting one note would blank the preview of
 * every encrypted note next to it.
 *
 * Only ever puts back content the caller already had in memory — it cannot invent
 * a body that was never fetched.
 */
export function restoreWithheldContent(next, previous) {
  if (!previous) return next;
  if (Array.isArray(next)) {
    if (!Array.isArray(previous)) return next;
    const held = new Map(previous.map((note) => [note?._id, note]));
    return next.map((note) => restoreWithheldContent(note, held.get(note?._id)));
  }
  if (!next || typeof next !== "object") return next;
  if (next.contentCached !== false) return next;
  if (previous.contentCached === false || !previous.content) return next;
  const { contentCached: _withheld, ...rest } = next;
  return { ...rest, content: previous.content };
}

// ---------------------------------------------------------------------------
// Change notification
// ---------------------------------------------------------------------------

// Mounted queries re-read when something else rewrites their entry — the case
// that matters is the outbox flushing in the background and replacing an
// optimistic local note with the real one under a page that is already open.
const listeners = new Set();

export function onCacheChange(listener) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

function announce(names) {
  if (!names.length) return;
  for (const listener of listeners) {
    try {
      listener(names);
    } catch (error) {
      console.warn("Cache listener failed:", error);
    }
  }
}

// ---------------------------------------------------------------------------
// Entries
// ---------------------------------------------------------------------------

/** `{ data, updatedAt }` for a cached resource, or null when there is no copy. */
export async function readEntry(owner, name) {
  if (!owner) return null;
  const record = await withStore(ENTRY_STORE, "readonly", (store, asPromise) =>
    asPromise(store.get(recordKey(owner, name)))
  );
  if (!record) return null;
  return { data: record.data, updatedAt: record.updatedAt };
}

/**
 * Stores a response. `updatedAt` is passed in rather than stamped here so that
 * re-persisting an entry the app read back from cache — or patched optimistically
 * — keeps its original age instead of pretending to be a fresh fetch.
 */
export async function writeEntry(owner, name, data, updatedAt = Date.now()) {
  if (!owner) return;
  await withStore(ENTRY_STORE, "readwrite", (store) =>
    store.put({
      key: recordKey(owner, name),
      owner,
      name,
      data: forStorage(data),
      updatedAt,
    })
  );
}

export async function dropEntry(owner, name) {
  if (!owner) return;
  await withStore(ENTRY_STORE, "readwrite", (store) =>
    store.delete(recordKey(owner, name))
  );
  announce([name]);
}

/** Every entry this owner has, as `{ name, data, updatedAt }`. */
async function allEntries(owner) {
  const records = await withStore(
    ENTRY_STORE,
    "readonly",
    (store, asPromise) => asPromise(store.index("owner").getAll(owner)),
    []
  );
  return records ?? [];
}

// ---------------------------------------------------------------------------
// Keeping the note caches true after a write
// ---------------------------------------------------------------------------

// Does a note belong in the list cached under `name`?
//
// "notes:all" is every note the user owns — folders narrow the home listing, they
// do not partition it — so a new note always belongs there. A folder-scoped list
// only takes it when the folder actually matches, and `notes:unfiled` only when
// the note has no folder at all.
function listAccepts(name, note) {
  if (name === NOTES_ALL) return true;
  const scope = name.slice(NOTE_LIST_PREFIX.length);
  if (scope === "unfiled") return !note.folder;
  return note.folder === scope;
}

/**
 * Applies one note mutation to everything cached about notes: each cached list,
 * the note's own entry, and the folder listing.
 *
 * Lists are *patched* rather than dropped because dropping only works online. An
 * offline create has no network to refetch from, so the patched list is the only
 * record that the note exists — and patching means an online create shows up on a
 * reload with no request at all.
 *
 * Folder note counts are the exception: they are derived, so the folder entry is
 * dropped and recomputed by the server on the next load rather than adjusted here.
 */
export async function syncNoteCaches(owner, { note, removeId } = {}) {
  if (!owner) return;
  const targetId = removeId ?? note?._id;
  if (!targetId) return;

  const touched = [];
  for (const record of await allEntries(owner)) {
    if (!record.name.startsWith(NOTE_LIST_PREFIX)) continue;
    if (!Array.isArray(record.data)) continue;

    const without = record.data.filter((n) => n._id !== targetId);
    const wasPresent = without.length !== record.data.length;

    let next = without;
    if (note && listAccepts(record.name, note)) {
      // Replace in place when the note was already listed, so an edit does not
      // reorder the grid; a genuinely new note goes to the front, matching the
      // API's `createdAt: -1` sort.
      next = wasPresent
        ? record.data.map((n) => (n._id === targetId ? note : n))
        : [note, ...without];
    } else if (!wasPresent) {
      continue; // nothing to add, nothing was removed
    }

    await writeEntry(owner, record.name, next, record.updatedAt);
    touched.push(record.name);
  }

  if (note) {
    await writeEntry(owner, noteKey(targetId), note);
  } else {
    await withStore(ENTRY_STORE, "readwrite", (store) =>
      store.delete(recordKey(owner, noteKey(targetId)))
    );
  }
  touched.push(noteKey(targetId));

  // A note moving in or out of a folder changes that folder's count.
  await withStore(ENTRY_STORE, "readwrite", (store) =>
    store.delete(recordKey(owner, FOLDERS))
  );
  touched.push(FOLDERS);

  announce(touched);
}

/**
 * Renames a note in place — the outbox uses this when a queued create comes back
 * from the server with its real id, so the optimistic card is replaced rather than
 * duplicated.
 */
export async function replaceCachedNote(owner, localId, note) {
  await syncNoteCaches(owner, { removeId: localId });
  await syncNoteCaches(owner, { note });
}

/** Everything cached for this user. Called on logout. */
export async function clearCache() {
  await destroyAll();
  announce([NOTES_ALL, FOLDERS]);
}
