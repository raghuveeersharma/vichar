import { useEffect, useState } from "react";
import { FolderPlusIcon } from "lucide-react";
import toast from "react-hot-toast";
import Button from "./Button";
import FolderCard from "./FolderCard";
import FolderNameDialog from "./FolderNameDialog";
import {
  createFolder,
  deleteFolder,
  fetchFolders,
  renameFolder,
  reportFolderError,
} from "../libs/folders";

// The folder strip above the note grid on the home page. Self-contained: it owns
// its own fetch and all four mutations, so Home does not thread folder state
// through props. Nothing else on the page depends on this data — deleting a
// folder cannot change which notes exist, because the API refuses to delete a
// folder that still holds any.
const FolderList = () => {
  const [folders, setFolders] = useState([]);
  const [unfiledCount, setUnfiledCount] = useState(0);
  // Starts true so the "no folders yet" line does not flash before the first
  // fetch resolves — same reasoning as Home's notes loader.
  const [loading, setLoading] = useState(true);
  // null = closed. Otherwise { mode: "create" } or { mode: "rename", folder }.
  const [dialog, setDialog] = useState(null);

  const load = async () => {
    try {
      const data = await fetchFolders();
      setFolders(data.folders);
      setUnfiledCount(data.unfiledCount);
    } catch (error) {
      // A 429 here is already reported by Home's own banner for the same page
      // load, so this stays quiet rather than stacking a toast on top of it.
      if (error.response?.status !== 429) {
        reportFolderError(error, "Failed to load folders");
      }
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  const handleCreate = async (name) => {
    try {
      const folder = await createFolder(name);
      // Insert in place rather than refetching: the list is name-sorted, and the
      // new folder is empty by construction, so the client already knows enough
      // to place it correctly.
      setFolders((prev) =>
        [...prev, { ...folder, noteCount: 0 }].sort((a, b) =>
          a.name.localeCompare(b.name, undefined, { sensitivity: "base" })
        )
      );
      setDialog(null);
      toast.success("Folder created");
    } catch (error) {
      // Left open on purpose so a rejected name (409 duplicate) can be edited
      // rather than retyped from scratch.
      reportFolderError(error, "Failed to create folder");
    }
  };

  const handleRename = async (name) => {
    const { _id } = dialog.folder;
    try {
      const updated = await renameFolder(_id, name);
      setFolders((prev) =>
        prev
          .map((f) => (f._id === _id ? { ...f, name: updated.name } : f))
          .sort((a, b) =>
            a.name.localeCompare(b.name, undefined, { sensitivity: "base" })
          )
      );
      setDialog(null);
      toast.success("Folder renamed");
    } catch (error) {
      reportFolderError(error, "Failed to rename folder");
    }
  };

  const handleDelete = async (folder) => {
    // Deleting a folder is refused server-side while it still holds notes, so
    // this confirm is about the folder itself and nothing else can be lost here.
    if (!window.confirm(`Delete the folder "${folder.name}"?`)) return;
    try {
      await deleteFolder(folder._id);
      setFolders((prev) => prev.filter((f) => f._id !== folder._id));
      toast.success("Folder deleted");
    } catch (error) {
      // The 409 path lands here, and its message names how many notes are in the
      // way — which is the whole point of blocking the delete.
      reportFolderError(error, "Failed to delete folder");
    }
  };

  // Nothing to show before the first fetch settles. The heading is held back too
  // rather than rendering above an empty row, which would jump as folders arrive.
  if (loading) return null;

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
              onDelete={handleDelete}
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
    </section>
  );
};

export default FolderList;
