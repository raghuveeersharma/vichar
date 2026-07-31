import mongoose from "mongoose";
const noteShema = new mongoose.Schema(
  {
    title: {
      type: String,
      required: true,
    },
    content: {
      type: String,
      required: true,
    },
    // Tenant boundary: every query in notesControllers filters on this field,
    // so a note is only ever visible to the user who created it.
    owner: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
  },
  { timestamps: true } // This option adds createdAt and updatedAt timestamps to the schema
);

// Backs the "my notes, newest first" listing on the home page
noteShema.index({ owner: 1, createdAt: -1 });

const Note = mongoose.model("Note", noteShema);
export default Note;
