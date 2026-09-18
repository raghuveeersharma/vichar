import mongoose from "mongoose";
import Folder from "../modals/folder.modal.js";
import Note from "../modals/note.modal.js";
import { LIMITS, normalizedText } from "../libs/requestValidation.js";

// Mounted behind `protect`, so req.user is always set. Same rule as notes: every
// query filters on owner rather than looking a folder up by id and comparing
// afterwards, and someone else's folder answers 404 rather than 403.

// Matches the unique index on { owner, name } — a query that compares names has
// to use the same collation as the index, or "Work" and "work" look distinct.
const NAME_COLLATION = { locale: "en", strength: 2 };

// Mongo throws this when a write violates a unique index. Here it can only be
// the { owner, name } index, so it always means "you already have that folder".
const DUPLICATE_KEY = 11000;

export async function getAllFolders(req, res) {
  try {
    const owner = req.user._id;
    // Counts come from the notes side in one aggregate rather than a query per
    // folder, so the listing is two round trips no matter how many folders
    // exist. They drive the UI's "3 notes" label and are also what makes the
    // delete guard's message specific.
    const [folders, counts] = await Promise.all([
      Folder.find({ owner }).collation(NAME_COLLATION).sort({ name: 1 }),
      Note.aggregate([
        { $match: { owner } },
        { $group: { _id: "$folder", count: { $sum: 1 } } },
      ]),
    ]);

    const countByFolder = new Map(
      counts.map(({ _id, count }) => [String(_id), count])
    );
    res.status(200).json({
      folders: folders.map((folder) => ({
        ...folder.toObject(),
        noteCount: countByFolder.get(String(folder._id)) ?? 0,
      })),
      // Notes with `folder: null` group under the "null" key. Sent alongside so
      // the client can show the Unfiled bucket without a second request.
      unfiledCount: countByFolder.get("null") ?? 0,
    });
  } catch (error) {
    console.error("Error in getAllFolders:", error);
    res.status(500).json({ message: "Internal server error" });
  }
}

// Exists so a deep link to a folder page can resolve its name in one request
// instead of fetching the whole listing to find one entry.
export async function getFolderById(req, res) {
  try {
    const { id } = req.params;
    // A malformed id would otherwise surface as a Mongoose CastError → 500;
    // 404 is both the honest answer and the one that leaks nothing.
    if (!mongoose.isValidObjectId(id)) {
      return res.status(404).json({ message: "Folder not found" });
    }
    const owner = req.user._id;
    const folder = await Folder.findOne({ _id: id, owner });
    if (!folder) {
      return res.status(404).json({ message: "Folder not found" });
    }
    const noteCount = await Note.countDocuments({ owner, folder: id });
    res.status(200).json({ ...folder.toObject(), noteCount });
  } catch (error) {
    console.error("Error in getFolderById:", error);
    res.status(500).json({ message: "Internal server error" });
  }
}

export async function createFolder(req, res) {
  try {
    const { name } = req.body ?? {};
    const nameResult = normalizedText(name, {
      label: "Folder name",
      maxLength: LIMITS.folderName,
    });
    if (nameResult.error) {
      return res.status(400).json({ message: nameResult.error });
    }
    const folder = await Folder.create({
      name: nameResult.value,
      owner: req.user._id,
    });
    res
      .status(201)
      .json({ message: "Folder created successfully", folder });
  } catch (error) {
    // Let the unique index decide, instead of checking for an existing name
    // first: a pre-check has a race between the read and the write, and two
    // concurrent creates would both pass it.
    if (error?.code === DUPLICATE_KEY) {
      return res
        .status(409)
        .json({ message: "You already have a folder with that name" });
    }
    console.error("Error in createFolder:", error);
    res.status(500).json({ message: "Internal server error" });
  }
}

export async function updateFolderById(req, res) {
  try {
    const { id } = req.params;
    const { name } = req.body ?? {};
    if (!mongoose.isValidObjectId(id)) {
      return res.status(404).json({ message: "Folder not found" });
    }
    const nameResult = normalizedText(name, {
      label: "Folder name",
      maxLength: LIMITS.folderName,
    });
    if (nameResult.error) {
      return res.status(400).json({ message: nameResult.error });
    }
    const folder = await Folder.findOneAndUpdate(
      { _id: id, owner: req.user._id },
      { name: nameResult.value },
      { new: true, runValidators: true }
    );
    if (!folder) {
      return res.status(404).json({ message: "Folder not found" });
    }
    res.status(200).json({ message: "Folder renamed successfully", folder });
  } catch (error) {
    if (error?.code === DUPLICATE_KEY) {
      return res
        .status(409)
        .json({ message: "You already have a folder with that name" });
    }
    console.error("Error in updateFolderById:", error);
    res.status(500).json({ message: "Internal server error" });
  }
}

export async function deleteFolderById(req, res) {
  try {
    const { id } = req.params;
    if (!mongoose.isValidObjectId(id)) {
      return res.status(404).json({ message: "Folder not found" });
    }
    const owner = req.user._id;
    // Refuse to delete a folder that still holds notes, so deleting a folder can
    // never take writing with it. Counting first (rather than deleting and then
    // repairing) keeps this a single decision with no half-applied state.
    const noteCount = await Note.countDocuments({ owner, folder: id });
    if (noteCount > 0) {
      return res.status(409).json({
        message: `This folder still has ${noteCount} ${
          noteCount === 1 ? "note" : "notes"
        }. Move or delete them first.`,
        noteCount,
      });
    }
    const folder = await Folder.findOneAndDelete({ _id: id, owner });
    if (!folder) {
      return res.status(404).json({ message: "Folder not found" });
    }
    res.status(200).json({ message: "Folder deleted successfully" });
  } catch (error) {
    console.error("Error in deleteFolderById:", error);
    res.status(500).json({ message: "Internal server error" });
  }
}
