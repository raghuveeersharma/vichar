import { LockIcon, PenBoxIcon, Trash2Icon } from "lucide-react";
import { Link } from "react-router";
import { formatDate } from "../libs/utils";
import { htmlToText } from "../libs/html";
import api from "../libs/axios";
import toast from "react-hot-toast";
import Button from "./Button";

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
    /* `border-t-*` only overrides the top edge of the 1px glass border, so the
       accent stripe sits on top of the panel's own outline rather than
       replacing it. */
    <Link
      to={`/note/${note._id}`}
      className="card glass-panel glass-interactive border-t-4 border-t-primary/70"
    >
      <div className="card-body">
        <h3 className="card-title text-base-content">
          {/* The body is stored encrypted, so mark it — the preview below looks
              identical to a normal note once the server has opened it, and
              nothing else would tell the two apart. */}
          {note.isEncrypted && (
            <LockIcon
              className="size-4 shrink-0 text-primary"
              aria-label="Encrypted note"
            />
          )}
          {note.title}
        </h3>
        {/* Notes are stored as editor HTML; the preview shows text, not markup.
            `grow-0` undoes daisyUI's `.card-body :where(p) { flex-grow: 1 }`,
            which stretches the paragraph past its line-clamp box in a grid
            that equalises card heights — a clipped fourth line then bleeds
            through under the ellipsis. The actions row takes the slack via
            `mt-auto` instead. */}
        {/* `decryptError` means the server has the ciphertext but could not open
            it (key rotated or lost). It sends a placeholder in place of the
            body, so flag it as a fault rather than passing it off as content. */}
        <p
          className={`line-clamp-3 grow-0 ${
            note.decryptError ? "italic text-error/80" : "text-base-content/80"
          }`}
        >
          {htmlToText(note.content)}
        </p>
        <div className="card-actions mt-auto items-center justify-between pt-4">
          <span className="text-sm text-base-content/70">
            {formatDate(new Date(note.createdAt))}
          </span>
          <div className="flex items-center gap-1">
            <PenBoxIcon className="size-4 text-info/70" />
            {/* Solid-ish rather than glass: a translucent button on a
                translucent card washes out into it. */}
            <Button
              variant="ghost-error"
              size="sm"
              square
              icon={Trash2Icon}
              aria-label="Delete note"
              className="border border-base-content/10 bg-base-300/70 hover:bg-error/20"
              onClick={(e) => handelDelete(e, note._id)}
            />
          </div>
        </div>
      </div>
    </Link>
  );
};

export default NoteCard;
