import {
  CloudOffIcon,
  FolderIcon,
  LockIcon,
  PenBoxIcon,
  Trash2Icon,
} from "lucide-react";
import { Link } from "react-router";
import { formatDate } from "../libs/utils";
import { htmlToText } from "../libs/html";
import { deleteNote } from "../libs/notes";
import toast from "react-hot-toast";
import Button from "./Button";
import { useAuth } from "../context/auth-context";

// `showFolder` is off inside a folder page, where every card in the grid is in the
// same folder and the label would repeat the heading on every tile.
const NoteCard = ({ note, setNotes, showFolder = true }) => {
  const { user } = useAuth();

  const handelDelete = async (e, id) => {
    e.preventDefault();
    if (!window.confirm("Are you sure you want to delete this note?")) return;
    try {
      const { queued } = await deleteNote(user?._id, id);
      // The delete also removes the note from every cached listing, but this grid
      // is updated by hand as well: it is the list the user is looking at, and it
      // should not wait on a round trip to IndexedDB to reflect the click.
      setNotes((prev) => prev.filter((note) => note._id !== id));
      toast.success(
        queued
          ? "Deleted on this device — it will sync when you're back online"
          : "Note deleted successfully"
      );
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
        {/* Reads as a breadcrumb above the title. Plain text, not a link: the whole
            card is already an anchor, and nesting one inside it is invalid HTML —
            browsers close the outer <a> early and the layout falls apart.
            `folderName` comes populated on note reads; an unfiled note has none. */}
        {showFolder && note.folderName && (
          <div className="flex items-center gap-1 text-xs text-base-content/60">
            <FolderIcon className="size-3 shrink-0" />
            <span className="truncate">{note.folderName}</span>
          </div>
        )}
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
            body, so flag it as a fault rather than passing it off as content.
            `contentCached: false` is the other absent body: an encrypted note read
            back from the offline cache, whose plaintext is deliberately never
            written to disk. Neither is content, so neither is shown as content. */}
        <p
          className={`line-clamp-3 grow-0 ${
            note.decryptError || note.contentCached === false
              ? "italic text-base-content/50"
              : "text-base-content/80"
          } ${note.decryptError ? "text-error/80" : ""}`}
        >
          {note.contentCached === false
            ? "Locked while offline — reconnect to read this note."
            : htmlToText(note.content)}
        </p>
        <div className="card-actions mt-auto items-center justify-between pt-4">
          <span className="flex items-center gap-2 text-sm text-base-content/70">
            {formatDate(new Date(note.createdAt))}
            {/* Written or edited offline and not yet sent. The badge is stored with
                the note rather than derived from the queue, so it survives a
                reload the same way the note itself does. */}
            {note.pending && (
              <span
                className="badge badge-ghost badge-sm gap-1 font-normal"
                title="Waiting to sync"
              >
                <CloudOffIcon className="size-3" />
                unsynced
              </span>
            )}
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
