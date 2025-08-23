import express from "express";
import {
  getAllNotes,
  createNote,
  getNoteById,
  updateNoteById,
  deleteNoteById,
} from "../controllers/notesControllers.js";

const router = express.Router();

// Define your routes here
router.get("/", getAllNotes);
router.post("/", createNote);
router.put("/:id", updateNoteById);
router.get("/:id", getNoteById);
router.delete("/:id", deleteNoteById);
export default router;
