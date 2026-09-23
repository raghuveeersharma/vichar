import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router";
import api from "../libs/axios";
import {
  ArrowLeftIcon,
  CheckIcon,
  CloudOffIcon,
  CopyIcon,
  LoaderIcon,
  LockIcon,
  Trash2,
} from "lucide-react";
import toast from "react-hot-toast";
import RichTextEditor from "../components/RichTextEditor";
import { htmlToText, isEmptyHtml, toEditorHtml } from "../libs/html";
import Button from "../components/Button";
import ConfirmDialog from "../components/ConfirmDialog";
import FolderSelect from "../components/FolderSelect";
import OfflineNotice from "../components/OfflineNotice";
import { UNFILED } from "../libs/folders";
import { deleteNote, isOfflineRefusal, updateNote } from "../libs/notes";
import useCachedQuery from "../hooks/useCachedQuery";
import { noteKey } from "../libs/cache";
import { isLocalId } from "../libs/outbox";
import { useAuth } from "../context/auth-context";
import useOnline from "../hooks/useOnline";

const NoteDetailPage = () => {
  const navigate = useNavigate();
  const { id } = useParams();
  const { user } = useAuth();
  const owner = user?._id;
  const isOnline = useOnline();
  const [saving, setSaving] = useState(false);
  const [copied, setCopied] = useState(false);
  const [confirmingDelete, setConfirmingDelete] = useState(false);

  // Reading a note is cached like the listings are, so opening one straight after
  // seeing it on the home page is usually free. The editor still needs a mutable
  // copy of its own — `data` below — because every keystroke changes it and the
  // cached copy must stay as it was fetched until a save succeeds.
  const {
    data: fetched,
    loading,
    offline,
  } = useCachedQuery(
    noteKey(id),
    () => api.get(`/notes/${id}`).then((res) => res.data),
    {
      // A note still sitting in the offline queue has no server id, so asking for
      // it could only fail. Its cached copy is the only copy there is.
      cacheOnly: isLocalId(id),
      onError: (error, { cached }) => {
        console.error("Error fetching notes:", error);
        if (error.response?.status === 429) {
          toast.error("Rate limit exceeded. Please try again later.");
        } else if (error.response?.status === 404) {
          // Either the note is gone or it belongs to another user — the API
          // does not distinguish the two on purpose.
          toast.error("Note not found");
          navigate("/", { replace: true });
        } else if (error.response?.status === 500) {
          // Covers the one 500 worth naming: an encrypted note the server could
          // not open. Bounce rather than opening an empty editor over it — a
          // save from here would replace the ciphertext with nothing.
          toast.error(error.response.data?.message ?? "Failed to fetch notes");
          navigate("/", { replace: true });
        } else if (error.response?.status !== 401 && !cached) {
          toast.error("Failed to fetch notes");
        }
      },
    }
  );

  const [data, setData] = useState({ title: "", content: "" });
  // Whether the user has changed anything in this form yet. It is what makes it
  // safe to seed from the cache first: a fresher copy arriving a moment later
  // replaces an untouched form, but never overwrites typing in progress.
  const [dirty, setDirty] = useState(false);

  const edit = (patch) => {
    setDirty(true);
    setData((prev) => ({ ...prev, ...patch }));
  };

  useEffect(() => {
    if (!fetched || dirty) return;
    // Notes saved before the rich-text editor are plain text — promote them to
    // HTML so their line breaks survive the round trip. `folder` is null for an
    // unfiled note; the select speaks in the UNFILED sentinel, and the save path
    // maps it back.
    setData({
      ...fetched,
      content: toEditorHtml(fetched.content),
      folder: fetched.folder ?? UNFILED,
    });
  }, [fetched, dirty]);

  // Flip the button back to "Copy" on its own so there is nothing to reset by
  // hand; the cleanup covers navigating away mid-timer.
  useEffect(() => {
    if (!copied) return;
    const timer = setTimeout(() => setCopied(false), 2000);
    return () => clearTimeout(timer);
  }, [copied]);

  const handelCopy = async () => {
    // Content is TipTap HTML. Write both flavours so a rich target (a doc, an
    // email) keeps the formatting while a plain one (an editor, a terminal)
    // gets readable text instead of markup. `ClipboardItem` is missing on
    // older Safari, so fall back to text only.
    const html = data.content ?? "";
    const text = htmlToText(html);
    if (!text.trim()) {
      toast.error("Nothing to copy");
      return;
    }
    try {
      if (typeof ClipboardItem === "function" && navigator.clipboard?.write) {
        await navigator.clipboard.write([
          new ClipboardItem({
            "text/html": new Blob([html], { type: "text/html" }),
            "text/plain": new Blob([text], { type: "text/plain" }),
          }),
        ]);
      } else {
        await navigator.clipboard.writeText(text);
      }
      setCopied(true);
      toast.success("Content copied");
    } catch (error) {
      console.error("Error copying note:", error);
      toast.error("Failed to copy content");
    }
  };

  const handelDelete = async () => {
    try {
      // A delete needs no key and carries no body, so unlike an edit it can be
      // queued while offline.
      const { queued } = await deleteNote(owner, id);
      toast.success(
        queued
          ? "Deleted on this device — it will sync when you're back online"
          : "Note deleted successfully"
      );
      navigate("/");
    } catch (error) {
      console.error("Error deleting note:", error);
      if (error.response?.status !== 401) {
        toast.error("Failed to delete note");
      }
    }
  };

  const handelSubmit = async (e, id) => {
    e.preventDefault();
    if (fetched?.isEncrypted && !isOnline) {
      toast.error("An encrypted note can only be edited while you're online");
      return;
    }
    if (!data.title.trim() || isEmptyHtml(data.content)) {
      toast.error("All fields are required");
      return;
    }
    setSaving(true);
    try {
      const { title, content, folder, isEncrypted } = data;
      // Patches the saved note into every cached listing, so the home page this
      // navigates to shows the edit without asking for the list again. Offline the
      // edit is queued — except for an encrypted note, which is refused rather
      // than held as plaintext until it can be sent.
      const { queued } = await updateNote(owner, id, {
        title,
        content,
        folder,
        isEncrypted,
      });
      toast.success(
        queued
          ? "Saved on this device — it will sync when you're back online"
          : "Note updated successfully"
      );
      navigate("/"); // only on success, so a failed save keeps the user's edits
    } catch (error) {
      console.error("Error updating note:", error);
      if (isOfflineRefusal(error)) {
        toast.error(error.message, { duration: 6000 });
      } else if (error.response && error.response.status === 429) {
        toast.error("Rate limit exceeded. Please try again later.");
      } else if (error.response?.status !== 401) {
        toast.error("Failed to update note");
      }
    } finally {
      setSaving(false);
    }
  };
  if (loading) {
    return (
      <div className="flex min-h-[calc(100vh-var(--navbar-h))] items-center justify-center">
        <LoaderIcon className="size-10 animate-spin text-primary" />
      </div>
    );
  }

  // Nothing fetched and nothing cached — the ordinary case offline. There is
  // nothing to edit and no way to get it, and the editor must not open on a blank
  // body: a save from there would write that emptiness over the real note. The 404
  // and 500 paths have already navigated away by this point.
  if (!fetched) {
    return (
      <div className="min-h-screen">
        <div className="container mx-auto px-4 py-8">
          <div className="mx-auto max-w-2xl">
            <Button to="/" variant="ghost" icon={ArrowLeftIcon} className="mb-4">
              Back to Notes
            </Button>
            <OfflineNotice
              title={offline ? undefined : "Note unavailable"}
              message={
                offline
                  ? "This note has not been saved for offline use on this device yet."
                  : "This note could not be loaded. Check your connection and try again."
              }
            />
          </div>
        </div>
      </div>
    );
  }

  // An encrypted note read back from the cache has no body: the plaintext is
  // deliberately never written to disk, because the key lives on the server and
  // storing the decrypted text would undo the point of encrypting it. Same
  // reasoning as the server's 500-instead-of-placeholder rule — an editor opened
  // over a body we do not have would save that gap back over the ciphertext.
  if (fetched?.isEncrypted && fetched.contentCached === false) {
    return (
      <div className="min-h-screen">
        <div className="container mx-auto px-4 py-8">
          <div className="mx-auto max-w-2xl">
            <Button to="/" variant="ghost" icon={ArrowLeftIcon} className="mb-4">
              Back to Notes
            </Button>
            <div className="glass-panel-strong flex flex-col items-center gap-5 px-6 py-12 text-center sm:px-10">
              <div className="rounded-full bg-primary/10 p-6">
                <LockIcon className="size-9 text-primary" />
              </div>
              <h3 className="text-xl font-bold">{fetched.title}</h3>
              <p className="max-w-sm text-sm text-base-content/70">
                This note is encrypted. Its contents are only ever unlocked by the
                server, so they are never stored on this device — reconnect to read
                or edit it.
              </p>
              <span className="flex items-center gap-2 text-xs text-base-content/50">
                <CloudOffIcon className="size-4" />
                waiting for a connection
              </span>
            </div>
          </div>
        </div>
      </div>
    );
  }

  const encryptedNote = Boolean(fetched?.isEncrypted);
  const offlineEncryptedEdit = encryptedNote && !isOnline;

  return (
    /* See CreatePage: no opaque wrapper, or the background layer is covered. */
    <div className="min-h-screen">
      <div className="container mx-auto px-4 py-8 ">
        <div className="max-w-2xl mx-auto">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <Button to="/" variant="ghost" icon={ArrowLeftIcon}>
              Back to Notes
            </Button>
            <div className="flex flex-wrap items-center gap-2">
              <Button
                variant="ghost"
                icon={copied ? CheckIcon : CopyIcon}
                iconClassName={copied ? "text-success" : ""}
                onClick={handelCopy}
              >
                {copied ? "Copied" : "Copy Content"}
              </Button>
              <Button
                variant="outline-error"
                icon={Trash2}
                onClick={() => setConfirmingDelete(true)}
              >
                Delete Note
              </Button>
            </div>
          </div>
          <div className="glass-panel-strong card mt-4">
            <div className="card-body">
              <h1 className="card-title text-2xl mb-4">
                Edit note
                {/* Encryption is fixed at creation, so this is a status badge,
                    not a toggle — an edit re-encrypts with the same key. */}
                {data.isEncrypted && (
                  <span className="badge badge-primary badge-outline gap-1 align-middle text-xs font-normal">
                    <LockIcon className="size-3" />
                    Encrypted
                  </span>
                )}
              </h1>
              {offlineEncryptedEdit && (
                <div className="alert mb-4 border border-warning/30 bg-warning/10 text-warning-content" role="status">
                  <CloudOffIcon className="size-5 shrink-0" />
                  <span className="text-sm">
                    This encrypted note cannot be edited offline. Reconnect to
                    continue; its plaintext is never saved on this device.
                  </span>
                </div>
              )}
              <form onSubmit={(e) => handelSubmit(e, id)}>
                <div className="form-control mb-4">
                  <label className="label">
                    <span className="label-text">Title</span>
                  </label>
                  <input
                    type="text"
                    placeholder="enter note title"
                    className="input input-bordered input-glass"
                    value={data.title}
                    onChange={(e) => edit({ title: e.target.value })}
                    disabled={offlineEncryptedEdit}
                    maxLength={200}
                    required
                  />
                </div>
                {/* Changing this moves the note: the save below sends `folder`
                    alongside the body, and the API only reassigns a note when the
                    request actually carries that key. */}
                <FolderSelect
                  value={data.folder ?? UNFILED}
                  onChange={(folder) => edit({ folder })}
                  disabled={saving || offlineEncryptedEdit}
                />
                <div className="form-control mb-4">
                  <label className="label">
                    <span className="label-text">content</span>
                  </label>
                  <RichTextEditor
                    value={data.content}
                    onChange={(content) => edit({ content })}
                    placeholder="enter note content"
                    disabled={offlineEncryptedEdit}
                  />
                </div>
                <div className="card-actions justify-end">
                  <Button
                    type="submit"
                    variant="primary"
                    loading={saving}
                    disabled={offlineEncryptedEdit}
                  >
                    {saving ? "Saving..." : "Save Changes"}
                  </Button>
                </div>
              </form>
            </div>
          </div>
        </div>
      </div>

      <ConfirmDialog
        open={confirmingDelete}
        title="Delete note"
        message={`"${data.title}" will be deleted. This cannot be undone.`}
        confirmLabel="Delete note"
        onConfirm={handelDelete}
        onClose={() => setConfirmingDelete(false)}
      />
    </div>
  );
};

export default NoteDetailPage;
