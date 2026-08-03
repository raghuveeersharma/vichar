import { useEffect, useState } from "react";
import toast from "react-hot-toast";
import { UNFILED, fetchFolders, reportFolderError } from "../libs/folders";

// The folder picker shared by the create and edit pages. `value` is a folder id or
// the UNFILED sentinel — the same two things the API accepts — so the parent can
// hand what it holds straight to the request body without translating.
//
// Owns its own fetch: both call sites need exactly this list and nothing else on
// either page depends on it, so lifting it into the pages would mean writing the
// same effect twice.
const FolderSelect = ({ value, onChange, disabled = false }) => {
  const [folders, setFolders] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      try {
        const data = await fetchFolders();
        if (cancelled) return;
        setFolders(data.folders);
        // A folder id can arrive from a `?folder=` link that outlived the folder
        // itself, or from a note whose folder is no longer in this list. Falling
        // back to Unfiled keeps the form usable — and says so, because silently
        // moving the note somewhere the user did not pick would be worse.
        if (value !== UNFILED && !data.folders.some((f) => f._id === value)) {
          toast.error("That folder no longer exists — using Unfiled");
          onChange(UNFILED);
        }
      } catch (error) {
        if (!cancelled) reportFolderError(error, "Failed to load folders");
      } finally {
        if (!cancelled) setLoading(false);
      }
    };
    load();
    return () => {
      cancelled = true;
    };
    // Once on mount: this validates the *initial* value. Re-running it on every
    // keystroke-driven change would refetch the list and could fight the user's
    // own selection.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className="form-control mb-4">
      <label className="label" htmlFor="note-folder">
        <span className="label-text">Folder</span>
      </label>
      <select
        id="note-folder"
        className="select select-bordered input-glass"
        // While the list is in flight the current value has no matching <option>,
        // which renders as a blank field. Showing the loading option instead keeps
        // the control from flashing empty.
        value={loading ? "" : value}
        onChange={(e) => onChange(e.target.value)}
        disabled={disabled || loading}
      >
        {loading ? (
          <option value="">Loading folders...</option>
        ) : (
          <>
            <option value={UNFILED}>Unfiled</option>
            {folders.map((folder) => (
              <option key={folder._id} value={folder._id}>
                {folder.name}
              </option>
            ))}
          </>
        )}
      </select>
    </div>
  );
};

export default FolderSelect;
