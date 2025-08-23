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
  },
  { timestamps: true } // This option adds createdAt and updatedAt timestamps to the schema
);

const Note = mongoose.model("Note", noteShema);
export default Note;
