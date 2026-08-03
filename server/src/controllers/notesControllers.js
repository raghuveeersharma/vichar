import mongoose from "mongoose";
import Note from "../modals/note.modal.js";
import Folder from "../modals/folder.modal.js";
import {
  decryptContent,
  encryptContent,
  encryptionUnavailableReason,
} from "../libs/noteCrypto.js";

// Every handler here is mounted behind the `protect` middleware, so req.user is
// always set. Reads and writes filter by owner instead of looking a note up by id
// alone — that filter is what keeps one user's notes invisible to another.

// Shown in place of a note body that will not open (key rotated or lost, blob
// corrupted). HTML because the client renders `content` as editor markup.
const UNREADABLE_PLACEHOLDER = "<p>[Encrypted — unable to decrypt]</p>";

// Notes leave here as plain objects with `content` already decrypted, so the
// client never sees the envelope and needs no crypto of its own. Encryption is
// a storage detail, not part of the API shape.
function toClientNote(doc, content) {
  return { ...doc.toObject(), content };
}

function readableContent(doc, owner) {
  if (!doc.isEncrypted) return doc.content;
  return decryptContent(doc.content, owner);
}

// The literal `?folder=` value that selects notes belonging to no folder. A word
// rather than an empty string, because `?folder=` with nothing after it is
// indistinguishable from a client that meant to send an id and sent undefined.
const UNFILED = "unfiled";

// Resolves the `folder` value a client sent into something safe to store: null
// for unfiled, or a folder id proven to belong to this user. Returning the id
// unchecked would let anyone file their own note into someone else's folder —
// harmless on its own, but it would make that folder's note count wrong and leak
// the fact that the id exists.
async function resolveFolder(value, owner) {
  if (
    value === null ||
    value === undefined ||
    value === "" ||
    value === UNFILED
  ) {
    return { folder: null };
  }
  if (!mongoose.isValidObjectId(value)) {
    return { error: "Folder not found" };
  }
  const exists = await Folder.exists({ _id: value, owner });
  if (!exists) {
    return { error: "Folder not found" };
  }
  return { folder: value };
}

export async function getAllNotes(req, res) {
  try {
    const owner = req.user._id;
    // No `folder` param at all means "every note I own", which is what the home
    // page asks for — folders narrow the listing, they do not partition it.
    // `?folder=unfiled` selects the notes in no folder, `?folder=<id>` one folder.
    const filter = { owner };
    if (req.query.folder !== undefined) {
      const { folder, error } = await resolveFolder(req.query.folder, owner);
      if (error) {
        return res.status(404).json({ message: error });
      }
      filter.folder = folder;
    }
    const notes = await Note.find(filter).sort({
      createdAt: -1,
    });
    // One unreadable note degrades to a placeholder rather than failing the
    // whole listing — the other notes are still perfectly fine to show.
    const payload = notes.map((note) => {
      try {
        return toClientNote(note, readableContent(note, owner));
      } catch (error) {
        console.error(`Error decrypting note ${note._id}:`, error);
        return { ...toClientNote(note, UNREADABLE_PLACEHOLDER), decryptError: true };
      }
    });
    // An empty list is a valid result, not a 404 — a new user simply has no notes.
    res.status(200).json(payload);
  } catch (error) {
    console.error("Error in getAllNotes:", error);
    res.status(500).json({ message: "Internal server error" });
  }
}

export async function createNote(req, res) {
  try {
    const { title, content, encrypted, folder } = req.body;
    if (!title || !content) {
      return res
        .status(400)
        .json({ message: "Title and content are required" });
    }
    const owner = req.user._id;
    // Omitting `folder` creates an unfiled note, so every existing client keeps
    // working untouched.
    const resolved = await resolveFolder(folder, owner);
    if (resolved.error) {
      return res.status(404).json({ message: resolved.error });
    }
    // Encryption is opt-in per note: the client posts `encrypted: true` from the
    // "Create encrypted note" button. Like the AI endpoints, a missing key is a
    // 503 naming the cause rather than a boot failure or a silent plaintext save
    // — quietly storing a note the user asked to encrypt would be the one
    // unacceptable outcome here.
    const shouldEncrypt = Boolean(encrypted);
    if (shouldEncrypt) {
      // Covers a missing key and a malformed one alike — both mean this note
      // cannot be sealed, and neither should be reported as a server fault.
      const unavailable = encryptionUnavailableReason();
      if (unavailable) {
        return res.status(503).json({ message: unavailable });
      }
    }
    const newNote = await Note.create({
      title,
      content: shouldEncrypt ? encryptContent(content, owner) : content,
      isEncrypted: shouldEncrypt,
      folder: resolved.folder,
      owner,
    });
    res.status(201).json({
      message: "Note created successfully",
      note: toClientNote(newNote, content),
    });
  } catch (error) {
    console.error("Error in createNote:", error);
    res.status(500).json({ message: "Internal server error" });
  }
}

export async function getNoteById(req, res) {
  try {
    const { id } = req.params;
    const owner = req.user._id;
    const note = await Note.findOne({ _id: id, owner });
    // 404 rather than 403 for someone else's note, so the response does not
    // confirm that the id exists.
    if (!note) {
      return res.status(404).json({ message: "Note not found" });
    }
    let content;
    try {
      content = readableContent(note, owner);
    } catch (error) {
      // Deliberately not the listing's placeholder: this response feeds the
      // edit form, and a placeholder there would be saved straight back over
      // the ciphertext, turning an unreadable note into a destroyed one.
      console.error(`Error decrypting note ${note._id}:`, error);
      return res
        .status(500)
        .json({ message: "Unable to decrypt this note" });
    }
    res.status(200).json(toClientNote(note, content));
  } catch (error) {
    console.error("Error in getNoteById:", error);
    res.status(500).json({ message: "Internal server error" });
  }
}

export async function updateNoteById(req, res) {
  try {
    const { id } = req.params;
    const { title, content } = req.body;
    if (!title || !content) {
      return res
        .status(400)
        .json({ message: "Title and content are required for update" });
    }
    const owner = req.user._id;
    // Read the stored flag first: an encrypted note stays encrypted no matter
    // what the client sends, so an edit can never silently write the body back
    // as plaintext. Both queries filter on owner, so the isolation rule holds.
    const existing = await Note.findOne({ _id: id, owner }).select("isEncrypted");
    if (!existing) {
      return res.status(404).json({ message: "Note not found" });
    }
    if (existing.isEncrypted) {
      const unavailable = encryptionUnavailableReason();
      if (unavailable) {
        return res.status(503).json({ message: unavailable });
      }
    }
    // Only move the note when the client actually sent a `folder` key. Reading it
    // off the body unconditionally would file every note edited by an older
    // client — or by any request that just sends title and content — back into
    // Unfiled as a side effect of saving.
    const update = {
      title,
      content: existing.isEncrypted ? encryptContent(content, owner) : content,
    };
    if ("folder" in req.body) {
      const resolved = await resolveFolder(req.body.folder, owner);
      if (resolved.error) {
        return res.status(404).json({ message: resolved.error });
      }
      update.folder = resolved.folder;
    }
    const note = await Note.findOneAndUpdate(
      { _id: id, owner },
      update,
      { new: true }
    );
    if (!note) {
      return res.status(404).json({ message: "Note not found" });
    }
    res.status(200).json({
      message: "Note updated successfully",
      note: toClientNote(note, content),
    });
  } catch (error) {
    console.error("Error in updateNoteById:", error);
    res.status(500).json({ message: "Internal server error" });
  }
}

export async function deleteNoteById(req, res) {
  try {
    const { id } = req.params;
    const note = await Note.findOneAndDelete({ _id: id, owner: req.user._id });
    if (!note) {
      return res.status(404).json({ message: "Note not found" });
    }
    res.status(200).json({ message: "Note deleted successfully" });
  } catch (error) {
    console.error("Error in deleteNoteById:", error);
    res.status(500).json({ message: "Internal server error" });
  }
}
