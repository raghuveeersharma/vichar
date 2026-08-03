import { FolderIcon, InboxIcon, PencilIcon, Trash2Icon } from "lucide-react";
import { Link } from "react-router";
import Button from "./Button";

// A folder tile on the home page. Deliberately shorter than a NoteCard: a folder
// has nothing to preview, so the tile is a target, not a summary.
//
// `unfiled` renders the same shape without rename/delete — the notes that belong
// to no folder are a view, not a document, so there is nothing there to rename
// or remove. It gets a different icon so it does not read as a real folder.
const FolderCard = ({ folder, unfiled = false, onRename, onDelete }) => {
  const Icon = unfiled ? InboxIcon : FolderIcon;
  const count = folder.noteCount ?? 0;

  return (
    <Link
      to={unfiled ? "/folder/unfiled" : `/folder/${folder._id}`}
      className="card glass-panel glass-interactive"
    >
      <div className="card-body gap-2 p-4 sm:p-5">
        <div className="flex items-start justify-between gap-2">
          <Icon
            className={`size-6 shrink-0 ${
              unfiled ? "text-base-content/50" : "text-primary"
            }`}
          />
          {!unfiled && (
            /* Solid-ish backgrounds for the same reason as NoteCard's delete
               button: a translucent button on a translucent card washes out. */
            <div className="flex items-center gap-1">
              <Button
                variant="ghost"
                size="sm"
                square
                icon={PencilIcon}
                aria-label={`Rename ${folder.name}`}
                className="border border-base-content/10 bg-base-300/70 hover:bg-primary/20"
                onClick={(e) => {
                  // The whole tile is a Link, so every button inside it has to
                  // stop the navigation it would otherwise trigger.
                  e.preventDefault();
                  onRename(folder);
                }}
              />
              <Button
                variant="ghost-error"
                size="sm"
                square
                icon={Trash2Icon}
                aria-label={`Delete ${folder.name}`}
                className="border border-base-content/10 bg-base-300/70 hover:bg-error/20"
                onClick={(e) => {
                  e.preventDefault();
                  onDelete(folder);
                }}
              />
            </div>
          )}
        </div>
        {/* `break-words` because a folder name can be 60 unbroken characters and
            the tile is one column of a 4-column grid. */}
        <h3 className="break-words font-semibold text-base-content">
          {unfiled ? "Unfiled" : folder.name}
        </h3>
        <span className="text-sm text-base-content/70">
          {count} {count === 1 ? "note" : "notes"}
        </span>
      </div>
    </Link>
  );
};

export default FolderCard;
