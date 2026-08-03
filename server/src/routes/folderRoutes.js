import express from "express";
import {
  getAllFolders,
  getFolderById,
  createFolder,
  updateFolderById,
  deleteFolderById,
} from "../controllers/folderControllers.js";

const router = express.Router();

// Mounted as app.use("/api/folders", protect, router) — the guard sits on the
// mount, so a route added here cannot forget it.
router.get("/", getAllFolders);
router.post("/", createFolder);
router.get("/:id", getFolderById);
// PATCH, not PUT: renaming is the only mutation, so this is a partial update of
// a folder rather than a replacement of one.
router.patch("/:id", updateFolderById);
router.delete("/:id", deleteFolderById);

export default router;
