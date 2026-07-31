import Note from "../modals/note.modal.js";

// Every handler here is mounted behind the `protect` middleware, so req.user is
// always set. Reads and writes filter by owner instead of looking a note up by id
// alone — that filter is what keeps one user's notes invisible to another.
export async function getAllNotes(req, res) {
  try {
    const notes = await Note.find({ owner: req.user._id }).sort({
      createdAt: -1,
    });
    // An empty list is a valid result, not a 404 — a new user simply has no notes.
    res.status(200).json(notes);
  } catch (error) {
    console.error("Error in getAllNotes:", error);
    res.status(500).json({ message: "Internal server error" });
  }
}

export async function createNote(req, res) {
  try {
    const { title, content } = req.body;
    if (!title || !content) {
      return res
        .status(400)
        .json({ message: "Title and content are required" });
    }
    const newNote = await Note.create({
      title,
      content,
      owner: req.user._id,
    });
    res
      .status(201)
      .json({ message: "Note created successfully", note: newNote });
  } catch (error) {
    console.error("Error in createNote:", error);
    res.status(500).json({ message: "Internal server error" });
  }
}

export async function getNoteById(req, res) {
  try {
    const { id } = req.params;
    const note = await Note.findOne({ _id: id, owner: req.user._id });
    // 404 rather than 403 for someone else's note, so the response does not
    // confirm that the id exists.
    if (!note) {
      return res.status(404).json({ message: "Note not found" });
    }
    res.status(200).json(note);
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
    const note = await Note.findOneAndUpdate(
      { _id: id, owner: req.user._id },
      { title, content },
      { new: true }
    );
    if (!note) {
      return res.status(404).json({ message: "Note not found" });
    }
    res.status(200).json({ message: "Note updated successfully", note });
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
