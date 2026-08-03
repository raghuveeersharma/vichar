import mongoose from "mongoose";

// Flat, single-level grouping for notes — a folder never contains another
// folder, so there is no parent ref, no cycle check and no recursion anywhere.
// A note points at one folder or at none ("unfiled"); the folder never holds a
// list of note ids, so moving a note is a one-document write and the two sides
// cannot disagree about where a note lives.
const folderSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: true,
      trim: true,
      maxlength: 60,
    },
    // Tenant boundary, same rule as notes: every query filters on this, so one
    // user's folders are invisible to another.
    owner: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
  },
  { timestamps: true }
);

// One folder name per user, compared case-insensitively (strength 2), so "Work"
// and "work" collide instead of becoming two indistinguishable folders in the
// listing. Unique per owner rather than globally — two users may both have
// "Work". The controllers rely on this index to reject duplicates: they catch
// the E11000 write error instead of pre-checking, which is what makes it safe
// against two concurrent creates. It also backs the name-sorted listing.
folderSchema.index(
  { owner: 1, name: 1 },
  { unique: true, collation: { locale: "en", strength: 2 } }
);

const Folder = mongoose.model("Folder", folderSchema);
export default Folder;
