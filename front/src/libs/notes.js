import api from "./axios";
import {
  FOLDERS,
  dropEntry,
  noteKey,
  readEntry,
  replaceCachedNote,
  syncNoteCaches,
} from "./cache";
import { UNFILED } from "./folders";
import {
  CREATE,
  DELETE,
  UPDATE,
  enqueue,
  isLocalId,
  listQueue,
  newLocalId,
  removeItem,
  replaceItem,
} from "./outbox";

// Every note write goes through here, so there is exactly one place that knows how
// a mutation reaches the server, the cached copies of the data it changes, and —
// when there is no connection — the queue that will send it later.
//
// Writing through rather than invalidating is what makes an offline reload honest:
// dropping the cached lists would work online, where the next page load can just
// ask again, but a note created with no connection has nothing to ask. Patching
// means the same code path covers both.

const isOffline = () => navigator.onLine === false;

/** `folder` as the API and the note document want it: an id, or null for unfiled. */
export const toFolderId = (folder) =>
  !folder || folder === UNFILED ? null : folder;

/**
 * Refused because it cannot be done without a connection, as opposed to failed.
 * Carries no `response`, so the pages' existing status branches fall through to
 * this message rather than reporting a server error that never happened.
 */
function offlineRefusal(message) {
  const error = new Error(message);
  error.offlineRefusal = true;
  return error;
}

export const isOfflineRefusal = (error) => Boolean(error?.offlineRefusal);

/**
 * A created or updated note comes back without its folder populated, so the label
 * NoteCard shows would be missing until the next full listing. The name is already
 * in the cached folder listing, so fill it in from there.
 */
async function withFolderName(owner, note) {
  if (!note?.folder || note.folderName) return note;
  const entry = await readEntry(owner, FOLDERS);
  const match = entry?.data?.folders?.find((f) => f._id === note.folder);
  return match ? { ...note, folderName: match.name } : note;
}

// ---------------------------------------------------------------------------
// Writes
// ---------------------------------------------------------------------------

export async function createNote(owner, { title, content, folder, encrypted }) {
  if (encrypted && isOffline()) {
    // The key lives on the server and the client has no way to seal anything, so
    // queueing this would mean holding the plaintext in IndexedDB until a
    // connection returns — writing to disk exactly what the user asked to have
    // encrypted. Refusing is the only answer that keeps that promise.
    throw offlineRefusal(
      "An encrypted note can only be created while you're online"
    );
  }

  if (!isOffline()) {
    const res = await api.post("/notes", { title, content, encrypted, folder });
    const note = await withFolderName(owner, res.data.note);
    await syncNoteCaches(owner, { note });
    return { note, queued: false };
  }

  // Stands in for the document the server will create. `pending` rides along into
  // the cache, so the card is still marked as unsent after a reload, and the id is
  // marked local so nothing tries to use it in a URL.
  const stamp = new Date().toISOString();
  const draft = await withFolderName(owner, {
    _id: newLocalId(),
    title,
    content,
    folder: toFolderId(folder),
    isEncrypted: false,
    owner,
    createdAt: stamp,
    updatedAt: stamp,
    pending: true,
  });
  await enqueue(owner, {
    kind: CREATE,
    noteId: draft._id,
    payload: { title, content, folder: toFolderId(folder) },
  });
  await syncNoteCaches(owner, { note: draft });
  return { note: draft, queued: true };
}

export async function updateNote(owner, id, { title, content, folder, isEncrypted }) {
  // A local id belongs to a note the server has never seen, so there is nothing to
  // PUT — even with a connection. The edit folds into the queued create instead,
  // which covers the window between reconnecting and the flush finishing.
  if (!isOffline() && !isLocalId(id)) {
    // `folder` is always sent from this client, which is what makes an edit able
    // to move a note; the server only reassigns when the key is actually present.
    const res = await api.put(`/notes/${id}`, { title, content, folder });
    const note = await withFolderName(owner, res.data.note);
    await syncNoteCaches(owner, { note });
    return { note, queued: false };
  }

  const cached = (await readEntry(owner, noteKey(id)))?.data;
  if (isEncrypted || cached?.isEncrypted) {
    // Same reason as an offline create: the body would have to sit in IndexedDB as
    // plaintext until it could be sent for sealing.
    throw offlineRefusal("An encrypted note can only be edited while you're online");
  }

  const payload = { title, content, folder: toFolderId(folder) };
  const queue = await listQueue(owner);
  // Collapse rather than append. A note created and then edited offline is still
  // one create, with the newer body; two edits to the same note are one update,
  // because the server would only keep the last one anyway.
  const pending =
    queue.find((item) => item.kind === CREATE && item.noteId === id) ??
    queue.find((item) => item.kind === UPDATE && item.noteId === id);
  if (pending) {
    await replaceItem({ ...pending, payload });
  } else {
    await enqueue(owner, { kind: UPDATE, noteId: id, payload });
  }

  const note = {
    ...(cached ?? { _id: id, isEncrypted: false, createdAt: new Date().toISOString() }),
    ...payload,
    _id: id,
    updatedAt: new Date().toISOString(),
    pending: true,
  };
  const labelled = await withFolderName(owner, note);
  await syncNoteCaches(owner, { note: labelled });
  return { note: labelled, queued: true };
}

export async function deleteNote(owner, id) {
  if (!isOffline() && !isLocalId(id)) {
    await api.delete(`/notes/${id}`);
    await syncNoteCaches(owner, { removeId: id });
    return { queued: false };
  }

  const queue = await listQueue(owner);
  if (isLocalId(id)) {
    // Never reached the server, so there is nothing to delete there — dropping the
    // queued create *is* the delete. Done even while online, because the flush may
    // not have got to it yet.
    for (const item of queue.filter((i) => i.noteId === id)) {
      await removeItem(item.id);
    }
  } else {
    // Queued edits to a note being deleted are pointless work and would fail with
    // a 404 after the delete lands.
    for (const item of queue.filter(
      (i) => i.noteId === id && i.kind === UPDATE
    )) {
      await removeItem(item.id);
    }
    await enqueue(owner, { kind: DELETE, noteId: id });
  }
  await syncNoteCaches(owner, { removeId: id });
  return { queued: true };
}

// ---------------------------------------------------------------------------
// Replay
// ---------------------------------------------------------------------------

/**
 * Sends whatever the queue is holding, oldest first, and reconciles the cache with
 * what the server actually did.
 *
 * Two failure classes, handled differently on purpose. A transport failure, 401,
 * 429 or 5xx says nothing about the item — the connection dropped again, the
 * session expired, the server is busy — so replay stops and the queue is kept
 * intact for the next attempt. A 4xx is a verdict that will not change however many
 * times it is repeated (the note was deleted elsewhere, its folder is gone), so the
 * item is dropped: one permanently rejected write must not wedge everything queued
 * behind it.
 */
export async function flushOutbox(owner) {
  const queue = await listQueue(owner);
  if (!owner || !queue.length || isOffline()) {
    return { sent: 0, dropped: 0, remaining: queue.length };
  }

  let sent = 0;
  let dropped = 0;
  let stopped = false;

  for (const item of queue) {
    try {
      if (item.kind === CREATE) {
        const res = await api.post("/notes", { ...item.payload, encrypted: false });
        const note = await withFolderName(owner, res.data.note);
        // The optimistic note is replaced rather than joined by the real one — its
        // local id is about to stop meaning anything.
        await replaceCachedNote(owner, item.noteId, note);
      } else if (item.kind === UPDATE) {
        const res = await api.put(`/notes/${item.noteId}`, item.payload);
        await syncNoteCaches(owner, {
          note: await withFolderName(owner, res.data.note),
        });
      } else if (item.kind === DELETE) {
        await api.delete(`/notes/${item.noteId}`);
        await syncNoteCaches(owner, { removeId: item.noteId });
      }
      await removeItem(item.id);
      sent += 1;
    } catch (error) {
      const status = error.response?.status;
      if (!status || status === 401 || status === 429 || status >= 500) {
        stopped = true;
        break;
      }
      await removeItem(item.id);
      // A delete that 404s already happened. That is the outcome the user asked
      // for, so it is a success, not a loss.
      if (item.kind === DELETE && status === 404) {
        sent += 1;
        continue;
      }
      console.error(`Dropping queued ${item.kind}:`, error);
      dropped += 1;
      if (item.kind === CREATE) {
        // It will never exist, so the optimistic card has to go with it.
        await syncNoteCaches(owner, { removeId: item.noteId });
      } else {
        // The note still exists on the server; only the edit was refused. Drop the
        // local copy so the next read takes the server's version rather than
        // showing changes that were never saved.
        await dropEntry(owner, noteKey(item.noteId));
      }
    }
  }

  const remaining = stopped ? (await listQueue(owner)).length : 0;
  return { sent, dropped, remaining };
}
