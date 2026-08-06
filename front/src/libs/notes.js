import api from "./axios";
import { FOLDERS, readEntry, syncNoteCaches } from "./cache";
import { UNFILED } from "./folders";

// Every note write goes through here, so there is exactly one place that knows how
// a mutation reaches both the server and the cached copies of the data it changes.
//
// Writing through rather than invalidating is what makes an offline reload honest:
// dropping the cached lists would work online, where the next page load can just
// ask again, but a note created with no connection has nothing to ask. Patching
// means the same code path covers both.

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

export async function createNote(owner, { title, content, folder, encrypted }) {
  const res = await api.post("/notes", { title, content, encrypted, folder });
  const note = await withFolderName(owner, res.data.note);
  await syncNoteCaches(owner, { note });
  return { note, queued: false };
}

export async function updateNote(owner, id, { title, content, folder }) {
  // `folder` is always sent from this client, which is what makes an edit able to
  // move a note; the server only reassigns when the key is actually present.
  const res = await api.put(`/notes/${id}`, { title, content, folder });
  const note = await withFolderName(owner, res.data.note);
  await syncNoteCaches(owner, { note });
  return { note, queued: false };
}

export async function deleteNote(owner, id) {
  await api.delete(`/notes/${id}`);
  await syncNoteCaches(owner, { removeId: id });
  return { queued: false };
}

/** `folder` as the API wants it: an id, or null for unfiled. */
export const toFolderId = (folder) =>
  !folder || folder === UNFILED ? null : folder;
