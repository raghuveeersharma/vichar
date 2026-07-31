import { PenBoxIcon, Trash2Icon } from "lucide-react";
import { Link } from "react-router";
import { formatDate } from "../libs/utils";
import api from "../libs/axios";
import toast from "react-hot-toast";

const NoteCard = ({ note, setNotes }) => {
  const handelDelete = async (e, id) => {
    e.preventDefault();
    if (!window.confirm("Are you sure you want to delete this note?")) return;
    try {
      const res = await api.delete(`/notes/${id}`);
      console.log(res.data);
      setNotes((prev) => prev.filter((note) => note._id !== id));
      toast.success("Note deleted successfully");
    } catch (error) {
      console.error("Error deleting note:", error);
      if (error.response && error.response.status === 429) {
        toast.error("Rate limit exceeded. Please try again later.");
      } else if (error.response?.status === 401) {
        // The axios interceptor already cleared the session; the redirect
        // happens on its own, so stay quiet here.
      } else {
        toast.error("Failed to delete note");
      }
    }
  };
  return (
    <Link
      to={`/note/${note._id}`}
      className="card bg-base-100 border-t-4 border-solid border-[#00FF9D] hover:shadow-lg transition-shadow duration-300"
    >
      <div className="card-body">
        <h3 className="card-title text-base-content">{note.title}</h3>
        <p className="text-base-content/70 line-clamp-3">{note.content}</p>
        <div className="card-actions items-center justify-between mt-4">
          <span className="text-sm text-base-content/70">
            {formatDate(new Date(note.createdAt))}
          </span>
          <div className="flex items-center gap-1">
            <PenBoxIcon className="size-4 text-blue-500/70" />
            <button
              className="btn btn-ghost btn-sm text-error"
              onClick={(e) => handelDelete(e, note._id)}
            >
              <Trash2Icon className="size-4" />
            </button>
          </div>
        </div>
      </div>
    </Link>
  );
};

export default NoteCard;
