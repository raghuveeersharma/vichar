import { useState } from "react";
import { FolderPlusIcon } from "lucide-react";
import toast from "react-hot-toast";
import Button from "./Button";
import FolderCard from "./FolderCard";
import FolderNameDialog from "./FolderNameDialog";
import ConfirmDialog from "./ConfirmDialog";
import {
  createFolder,
  deleteFolder,
  fetchFolders,
  renameFolder,
  reportFolderError,
} from "../libs/folders";
import useCachedQuery from "../hooks/useCachedQuery";
import { FOLDERS } from "../libs/cache";
import useOnline from "../hooks/useOnline";

// The folder strip above the note grid on the home page. Self-contained: it owns
// its own fetch and all four mutations, so Home does not thread folder state
// through props. Nothing else on the page depends on this data — deleting a
// folder cannot change which notes exist, because the API refuses to delete a
// folder that still holds any.
const FolderList = () => {
  // Shares one cached copy with FolderSelect and FolderPage, so opening the
  // create form right after the home page loaded reuses this listing instead of
  // asking for it again. A longer stale window than the note lists: folder names
  // change far less often than note bodies.
  const { data, loading, setData } = useCachedQuery(FOLDERS, fetchFolders, {
    staleTime: 60_000,
    onError: (error) => {
      // A 429 here is already reported by Home's own banner for the same page
      // load, so this stays quiet rather than stacking a toast on top of it.
      if (error.response?.status !== 429) {
        reportFolderError(error, "Failed to load folders");
      }
    },
  });
  const online = useOnline();
  // null = closed. Otherwise { mode: "create" } or { mode: "rename", folder }.
  const [dialog, setDialog] = useState(null);
  // The folder awaiting delete confirmation, or null.
  const [deleting, setDeleting] = useState(null);

  const folders = data?.folders ?? [];
  const unfiledCount = data?.unfiledCount ?? 0;

  // Patch the cached payload in place — the cache is what the next page load
  // reads, so a rename that only touched component state would be undone by a
  // reload inside the stale window.
  const patchFolders = (update) =>
    setData((prev) => ({
      ...(prev ?? { unfiledCount: 0 }),
      folders: update(prev?.folders ?? []).sort((a, b) =>
        a.name.localeCompare(b.name, undefined, { sensitivity: "base" })
      ),
    }));

  // Folder writes are online-only, unlike note writes. An offline create would
  // have to invent a local id, and notes filed under it would then all need
  // rewriting when the server issued the real one — a whole second consistency
  // problem for the rarer action. Saying so up front beats a request that fails.
  const requireConnection = () => {
    if (online) return true;
    toast.error("Folders can only be changed while you're online");
    return false;
  };

  const handleCreate = async (name) => {
    if (!requireConnection()) return;
    try {
      const folder = await createFolder(name);
      // Insert in place rather than refetching: the list is name-sorted, and the
      // new folder is empty by construction, so the client already knows enough
      // to place it correctly.
      patchFolders((prev) => [...prev, { ...folder, noteCount: 0 }]);
      setDialog(null);
      toast.success("Folder created");
    } catch (error) {
      // Left open on purpose so a rejected name (409 duplicate) can be edited
      // rather than retyped from scratch.
      reportFolderError(error, "Failed to create folder");
    }
  };

  const handleRename = async (name) => {
    if (!requireConnection()) return;
    const { _id } = dialog.folder;
    try {
      const updated = await renameFolder(_id, name);
      patchFolders((prev) =>
        prev.map((f) => (f._id === _id ? { ...f, name: updated.name } : f))
      );
      setDialog(null);
      toast.success("Folder renamed");
    } catch (error) {
      reportFolderError(error, "Failed to rename folder");
    }
  };

  // The connection check happens before the prompt, not after it: a folder write
  // offline is refused outright, and asking the user to confirm something that
  // was never going to run is worse than saying so up front.
  const requestDelete = (folder) => {
    if (!requireConnection()) return;
    setDeleting(folder);
  };

  const handleDelete = async () => {
    const folder = deleting;
    try {
      await deleteFolder(folder._id);
      patchFolders((prev) => prev.filter((f) => f._id !== folder._id));
      toast.success("Folder deleted");
    } catch (error) {
      // The 409 path lands here, and its message names how many notes are in the
      // way — which is the whole point of blocking the delete.
      reportFolderError(error, "Failed to delete folder");
    }
  };

  // Nothing to show before there is an answer — from cache or from the network.
  // The heading is held back too rather than rendering above an empty row, which
  // would jump as folders arrive. Offline with nothing cached lands here as well:
  // Home's own notice already explains why the page is bare.
  if (loading || !data) return null;

  const hasFolders = folders.length > 0;

  return (
    <section className="mb-8">
      <div className="mb-3 flex items-center justify-between gap-2">
        <h2 className="text-lg font-semibold text-base-content/90">Folders</h2>
        <Button
          variant="outline-primary"
          size="sm"
          icon={FolderPlusIcon}
          onClick={() => setDialog({ mode: "create" })}
        >
          new folder
        </Button>
      </div>

      {hasFolders || unfiledCount > 0 ? (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4 lg:gap-4">
          {folders.map((folder) => (
            <FolderCard
              key={folder._id}
              folder={folder}
              onRename={(f) => setDialog({ mode: "rename", folder: f })}
              onDelete={requestDelete}
            />
          ))}
          {/* Only worth a tile when something is actually unfiled — an empty
              Unfiled bucket is a place the user can never usefully go. */}
          {unfiledCount > 0 && (
            <FolderCard folder={{ noteCount: unfiledCount }} unfiled />
          )}
        </div>
      ) : (
        <p className="text-sm text-base-content/70">
          No folders yet. Create one to group your notes.
        </p>
      )}

      <FolderNameDialog
        open={dialog !== null}
        heading={dialog?.mode === "rename" ? "Rename folder" : "New folder"}
        submitLabel={dialog?.mode === "rename" ? "Rename" : "Create"}
        initialName={dialog?.mode === "rename" ? dialog.folder.name : ""}
        onSubmit={dialog?.mode === "rename" ? handleRename : handleCreate}
        onClose={() => setDialog(null)}
      />

      {/* Mounted only while there is a folder to name in the message — unlike the
          rename dialog, whose field keeps its value on the way out, this one has
          nothing to show once the folder is cleared.
          The server refuses to delete a folder that still holds notes, so this
          prompt is about the folder itself and nothing else can be lost behind it. */}
      {deleting && (
        <ConfirmDialog
          open
          title="Delete folder"
          message={`The folder "${deleting.name}" will be deleted. This cannot be undone.`}
          confirmLabel="Delete folder"
          onConfirm={handleDelete}
          onClose={() => setDeleting(null)}
        />
      )}
    </section>
  );
};

export default FolderList;
