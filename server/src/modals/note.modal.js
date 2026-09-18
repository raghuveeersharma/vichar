import mongoose from "mongoose";
const noteShema = new mongoose.Schema(
  {
    title: {
      type: String,
      required: true,
      trim: true,
      maxlength: 200,
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
    // The one folder this note lives in, or null for "unfiled". Nullable rather
    // than required: notes written before folders existed have no folder, and a
    // note must stay reachable after its folder is gone. The reference is only
    // ever set to a folder the same user owns — controllers verify that, since
    // `ref` alone does not.
    folder: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Folder",
      default: null,
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
// Backs the same listing narrowed to one folder, and the per-folder note counts
// that gate folder deletion. Kept alongside the index above rather than
// replacing it: a query with no folder filter cannot use a prefix it skips.
noteShema.index({ owner: 1, folder: 1, createdAt: -1 });

const Note = mongoose.model("Note", noteShema);
export default Note;
