import mongoose from "mongoose";
const noteShema = new mongoose.Schema(
  {
    title: {
      type: String,
      required: true,
    },
    // Either the editor's HTML fragment or, when `isEncrypted`, the
    // `enc:v1:...` envelope from libs/noteCrypto.js. Still a plain String
    // either way, so nothing else in the schema has to know the difference.
    content: {
      type: String,
      required: true,
    },
    // Set once at creation and preserved by updates. Controllers read this to
    // decide whether `content` needs decrypting — never sniff the string.
    isEncrypted: {
      type: Boolean,
      default: false,
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
