import { useEffect, useRef } from "react";
import toast from "react-hot-toast";
import { UNFILED, fetchFolders, reportFolderError } from "../libs/folders";
import useCachedQuery from "../hooks/useCachedQuery";
import { FOLDERS } from "../libs/cache";

// The folder picker shared by the create and edit pages. `value` is a folder id or
// the UNFILED sentinel — the same two things the API accepts — so the parent can
// hand what it holds straight to the request body without translating.
//
// Owns its own fetch: both call sites need exactly this list and nothing else on
// either page depends on it, so lifting it into the pages would mean writing the
// same effect twice. It reads the same cached `folders` resource FolderList does,
// so arriving here from the home page usually costs no request at all.
const FolderSelect = ({ value, onChange, disabled = false }) => {
  const { data, loading } = useCachedQuery(FOLDERS, fetchFolders, {
    staleTime: 60_000,
    onError: (error) => reportFolderError(error, "Failed to load folders"),
  });

  const folders = data?.folders ?? [];
  // No listing at all — offline, first visit, nothing cached. The value is still
  // whatever the note carries, and it has to survive the save, so it is offered as
  // its own option rather than being second-guessed against a list we do not have.
  const unknown = value !== UNFILED && !folders.some((f) => f._id === value);
  const listMissing = !data;

  // Validates the *initial* value, once, as soon as there is a real listing to
  // validate it against. A folder id can arrive from a `?folder=` link that
  // outlived the folder itself, or from a note whose folder is gone. Falling back
  // to Unfiled keeps the form usable — and says so, because silently moving the
  // note somewhere the user did not pick would be worse.
  //
  // Guarded by a ref rather than an empty dep list: the listing can arrive from
  // the cache and then again from the network, and re-running would fight a
  // selection the user has since made.
  const validated = useRef(false);
  useEffect(() => {
    if (validated.current || listMissing) return;
    validated.current = true;
    if (unknown) {
      toast.error("That folder no longer exists — using Unfiled");
      onChange(UNFILED);
    }
    // `unknown` and `onChange` are read at the moment the listing lands; adding
    // them here would re-arm the check against later edits.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [listMissing]);

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
        // Nothing to choose from means nothing to choose: leaving it live would
        // only offer to move the note to Unfiled, which is not a choice the user
        // came here to make.
        disabled={disabled || loading || listMissing}
      >
        {loading ? (
          <option value="">Loading folders...</option>
        ) : (
          <>
            <option value={UNFILED}>Unfiled</option>
            {listMissing && unknown && (
              <option value={value}>Current folder (offline)</option>
            )}
            {folders.map((folder) => (
              <option key={folder._id} value={folder._id}>
                {folder.name}
              </option>
            ))}
          </>
        )}
      </select>
      {listMissing && !loading && (
        <span className="label-text-alt mt-1 text-base-content/60">
          Folders are unavailable offline — this note keeps the folder it is in.
        </span>
      )}
    </div>
  );
};

export default FolderSelect;
