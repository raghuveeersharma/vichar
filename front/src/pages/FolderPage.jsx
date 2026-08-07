import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router";
import {
  ArrowLeftIcon,
  FolderIcon,
  InboxIcon,
  LoaderIcon,
  NotebookIcon,
  PencilIcon,
  PlusIcon,
  Trash2Icon,
} from "lucide-react";
import toast from "react-hot-toast";
import api from "../libs/axios";
import NoteCard from "../components/NoteCard";
import RateLimitUI from "../components/RateLimitUI";
import FolderNameDialog from "../components/FolderNameDialog";
import ConfirmDialog from "../components/ConfirmDialog";
import Button from "../components/Button";
import OfflineNotice from "../components/OfflineNotice";
import {
  UNFILED,
  deleteFolder,
  fetchFolders,
  renameFolder,
  reportFolderError,
} from "../libs/folders";
import useCachedQuery from "../hooks/useCachedQuery";
import useOnline from "../hooks/useOnline";
import { FOLDERS, notesKey } from "../libs/cache";

// One folder's notes. `/folder/unfiled` is the same page for notes that belong to
// no folder: it has a name and a note list like any other view, but nothing to
// rename or delete, because there is no folder document behind it.
const FolderPage = () => {
  const { folderId } = useParams();
  const navigate = useNavigate();
  const online = useOnline();
  const isUnfiled = folderId === UNFILED;

  const [renaming, setRenaming] = useState(false);
  const [deleting, setDeleting] = useState(false);

  // The name and note count come out of the shared `folders` listing rather than
  // `GET /folders/:id`. It is the same data, it is already cached by the home page
  // this link was clicked from, and it is the only version of this page's heading
  // that can be shown offline.
  const {
    data: folderData,
    loading: foldersLoading,
    setData: setFolderData,
  } = useCachedQuery(FOLDERS, fetchFolders, {
    staleTime: 60_000,
    enabled: !isUnfiled,
    onError: (error, { cached }) => {
      if (error.response?.status === 429 || cached) return;
      reportFolderError(error, "Failed to load folder");
    },
  });

  // The folder id doubles as the `?folder=` value, including "unfiled", so the
  // route param is forwarded to both the request and the cache key untranslated.
  const {
    data: noteData,
    loading: notesLoading,
    error: notesError,
    offline,
    setData: setNotes,
  } = useCachedQuery(
    notesKey(folderId),
    () => api.get(`/notes?folder=${folderId}`).then((res) => res.data),
    {
      onError: (error, { cached }) => {
        console.error("Error loading folder:", error);
        if (error.response?.status === 429) return;
        if (error.response?.status === 404) {
          // Gone, or it was never this user's — the API does not distinguish.
          toast.error("Folder not found");
          navigate("/", { replace: true });
          return;
        }
        if (error.response?.status === 401 || cached) return;
        if (error.response) toast.error("Failed to load folder");
      },
    }
  );

  const notes = noteData ?? [];
  const folders = folderData?.folders ?? null;
  const folder = folders?.find((f) => f._id === folderId) ?? null;
  const isRateLimit = notesError?.response?.status === 429;
  const loading = notesLoading || (!isUnfiled && foldersLoading);

  // A folder that is not in the listing is gone — the same conclusion the old
  // `GET /folders/:id` 404 reached. Only trusted once there *is* a listing: with
  // nothing cached and no connection, absence proves nothing.
  useEffect(() => {
    if (isUnfiled || !folders || folder) return;
    toast.error("Folder not found");
    navigate("/", { replace: true });
  }, [isUnfiled, folders, folder, navigate]);

  const patchFolders = (update) =>
    setFolderData((prev) => ({
      ...(prev ?? { unfiledCount: 0 }),
      folders: update(prev?.folders ?? []),
    }));

  // Folder writes need the network — see the same guard in FolderList.
  const requireConnection = () => {
    if (online) return true;
    toast.error("Folders can only be changed while you're online");
    return false;
  };

  const handleRename = async (name) => {
    if (!requireConnection()) return;
    try {
      const updated = await renameFolder(folderId, name);
      patchFolders((prev) =>
        prev.map((f) => (f._id === folderId ? { ...f, name: updated.name } : f))
      );
      setRenaming(false);
      toast.success("Folder renamed");
    } catch (error) {
      reportFolderError(error, "Failed to rename folder");
    }
  };

  // Refused offline before the prompt rather than after it — see FolderList.
  const requestDelete = () => {
    if (!requireConnection()) return;
    setDeleting(true);
  };

  const handleDelete = async () => {
    try {
      await deleteFolder(folderId);
      patchFolders((prev) => prev.filter((f) => f._id !== folderId));
      toast.success("Folder deleted");
      navigate("/", { replace: true });
    } catch (error) {
      // A folder with notes in it cannot be deleted; the 409's message says how
      // many are in the way. Staying on the page is right — they are listed
      // right here, which is where the user has to deal with them.
      reportFolderError(error, "Failed to delete folder");
    }
  };

  if (loading) {
    return (
      <div className="flex min-h-[calc(100vh-var(--navbar-h))] items-center justify-center">
        <LoaderIcon className="size-10 animate-spin text-primary" />
      </div>
    );
  }

  const Icon = isUnfiled ? InboxIcon : FolderIcon;
  const title = isUnfiled ? "Unfiled" : folder?.name;
  // Offline and this folder's notes were never stored — distinct from an empty
  // folder, which is a fact rather than a gap.
  const isOfflineEmpty = offline && noteData == null;

  return (
    <div className="min-h-screen">
      {isRateLimit && <RateLimitUI />}
      <div className="mx-auto mt-6 max-w-6xl px-4 py-4">
        <Button to="/" variant="ghost" icon={ArrowLeftIcon} className="mb-4">
          Back to Notes
        </Button>

        <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
          <div className="flex min-w-0 items-center gap-3">
            <Icon
              className={`size-7 shrink-0 ${
                isUnfiled ? "text-base-content/50" : "text-primary"
              }`}
            />
            <div className="min-w-0">
              {/* `break-words`: a 60-character name with no spaces would
                  otherwise push the actions off a narrow screen. */}
              <h1 className="break-words text-2xl font-bold sm:text-3xl">
                {title}
              </h1>
              {!isOfflineEmpty && (
                <p className="text-sm text-base-content/70">
                  {notes.length} {notes.length === 1 ? "note" : "notes"}
                </p>
              )}
            </div>
          </div>
          {/* Unfiled is a view, not a folder, so it has no rename or delete. It
              still gets "new note", which just creates an unfiled one. */}
          {isUnfiled ? (
            <Button to="/create" variant="primary" icon={PlusIcon} size="sm">
              new note
            </Button>
          ) : (
            folder && (
              <div className="flex flex-wrap items-center gap-2">
                {/* Carries the folder in the query string, which CreatePage reads
                    as the initial value of its folder picker. */}
                <Button
                  to={`/create?folder=${folderId}`}
                  variant="primary"
                  icon={PlusIcon}
                  size="sm"
                >
                  new note
                </Button>
                <Button
                  variant="ghost"
                  icon={PencilIcon}
                  size="sm"
                  onClick={() => setRenaming(true)}
                >
                  rename
                </Button>
                <Button
                  variant="outline-error"
                  icon={Trash2Icon}
                  size="sm"
                  onClick={requestDelete}
                >
                  delete
                </Button>
              </div>
            )
          )}
        </div>

        {isOfflineEmpty && (
          <OfflineNotice message="This folder's notes have not been saved for offline use on this device yet." />
        )}

        {!isRateLimit && !isOfflineEmpty && notes.length === 0 && (
          <div className="glass-panel-strong mx-auto mt-8 flex max-w-md flex-col items-center justify-center space-y-6 px-6 py-12 text-center sm:px-10 sm:py-16">
            <div className="rounded-full bg-primary/10 p-8">
              <NotebookIcon className="size-10 text-primary" />
            </div>
            <h3 className="text-2xl font-bold">
              {isUnfiled ? "Nothing unfiled" : "This folder is empty"}
            </h3>
            <p className="text-base-content/80">
              {isUnfiled
                ? "Every note you have is filed in a folder."
                : "Notes you put in this folder will show up here."}
            </p>
            {/* Nothing to offer on an empty Unfiled view: a note created from here
                would be unfiled, which is exactly the state the user is looking at
                and would land them back on this same empty page. */}
            {!isUnfiled && (
              <Button
                to={`/create?folder=${folderId}`}
                variant="primary"
                icon={PlusIcon}
              >
                New note in this folder
              </Button>
            )}
          </div>
        )}

        {notes.length > 0 && !isRateLimit && (
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 lg:gap-6 xl:grid-cols-4">
            {notes.map((note) => (
              <NoteCard
                key={note._id}
                note={note}
                setNotes={setNotes}
                // Every card here is in this folder; the heading already says so.
                showFolder={false}
              />
            ))}
          </div>
        )}
      </div>

      {!isUnfiled && (
        <>
          <FolderNameDialog
            open={renaming}
            heading="Rename folder"
            submitLabel="Rename"
            initialName={folder?.name ?? ""}
            onSubmit={handleRename}
            onClose={() => setRenaming(false)}
          />
          {/* The 409 path means an occupied folder never gets this far, so the
              prompt is about the folder alone. */}
          <ConfirmDialog
            open={deleting}
            title="Delete folder"
            message={`The folder "${folder?.name}" will be deleted. This cannot be undone.`}
            confirmLabel="Delete folder"
            onConfirm={handleDelete}
            onClose={() => setDeleting(false)}
          />
        </>
      )}
    </div>
  );
};

export default FolderPage;
