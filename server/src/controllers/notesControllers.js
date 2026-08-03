import Note from "../modals/note.modal.js";
import {
  decryptContent,
  encryptContent,
  isEncryptionConfigured,
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

export async function getAllNotes(req, res) {
  try {
    const owner = req.user._id;
    const notes = await Note.find({ owner }).sort({
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
    const { title, content, encrypted } = req.body;
    if (!title || !content) {
      return res
        .status(400)
        .json({ message: "Title and content are required" });
    }
    const owner = req.user._id;
    // Encryption is opt-in per note: the client posts `encrypted: true` from the
    // "Create encrypted note" button. Like the AI endpoints, a missing key is a
    // 503 naming the cause rather than a boot failure or a silent plaintext save
    // — quietly storing a note the user asked to encrypt would be the one
    // unacceptable outcome here.
    const shouldEncrypt = Boolean(encrypted);
    if (shouldEncrypt && !isEncryptionConfigured()) {
      return res.status(503).json({
        message:
          "Encrypted notes are not available: NOTE_ENCRYPTION_KEY is not configured on the server",
      });
    }
    const newNote = await Note.create({
      title,
      content: shouldEncrypt ? encryptContent(content, owner) : content,
      isEncrypted: shouldEncrypt,
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
    if (existing.isEncrypted && !isEncryptionConfigured()) {
      return res.status(503).json({
        message:
          "Encrypted notes are not available: NOTE_ENCRYPTION_KEY is not configured on the server",
      });
    }
    const note = await Note.findOneAndUpdate(
      { _id: id, owner },
      {
        title,
        content: existing.isEncrypted
          ? encryptContent(content, owner)
          : content,
      },
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
