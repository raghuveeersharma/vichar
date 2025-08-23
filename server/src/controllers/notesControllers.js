import Note from "../modals/note.modal.js";
export async function getAllNotes(_, res) {
  try {
    const notes = await Note.find().sort({ createdAt: -1 }); // Fetch all notes sorted by creation date
    if (!notes || notes.length === 0) {
      return res.status(404).json({ message: "No notes found" });
    }
    // Return the notes in JSON format
    res.status(200).json(notes);
  } catch (error) {
    console.error("Error in getAllNotes:", error);
    res.status(500).json({ message: "Internal server error" });
  }
}
export function createNote(req, res) {
  try {
    const { title, content } = req.body;
    if (!title || !content) {
      return res
        .status(400)
        .json({ message: "Title and content are required" });
    }
    const newNote = new Note({ title, content });
    newNote.save();
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
    const note = await Note.findById(id);
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
    await Note.findByIdAndUpdate(id, { title, content }, { new: true });
    res.status(200).json({ message: "Note updated successfully" });
  } catch (error) {
    console.error("Error in updateNoteById:", error);
    res.status(500).json({ message: "Internal server error" });
  }
}
export async function deleteNoteById(req, res) {
  try {
    const { id } = req.params;
    const note = await Note.findByIdAndDelete(id);
    if (!note) {
      return res.status(404).json({ message: "Note not found" });
    }
    res.status(200).json({ message: "Note deleted successfully" });
  } catch (error) {
    console.error("Error in deleteNoteById:", error);
    res.status(500).json({ message: "Internal server error" });
  }
}
