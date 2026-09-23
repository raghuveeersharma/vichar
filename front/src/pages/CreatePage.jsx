import { ArrowLeftIcon, CloudOffIcon, LockIcon } from "lucide-react";
import { useState } from "react";
import toast from "react-hot-toast";
import { createNote as saveNote, isOfflineRefusal } from "../libs/notes";
import { useNavigate, useSearchParams } from "react-router";
import RichTextEditor from "../components/RichTextEditor";
import { isEmptyHtml } from "../libs/html";
import Button from "../components/Button";
import FolderSelect from "../components/FolderSelect";
import { UNFILED } from "../libs/folders";
import { useAuth } from "../context/auth-context";
import useOnline from "../hooks/useOnline";

const CreatePage = () => {
  // Opt-in per account, from Settings. The server enforces the same flag on
  // POST /notes, so this hides a button rather than being the only thing
  // standing between a request and an encrypted note.
  const { user } = useAuth();
  const canEncrypt = Boolean(user?.encryptedNotesEnabled);
  const isOnline = useOnline();
  // `?folder=<id>` is how "new note in this folder" arrives from a folder page.
  // Read once as the initial value rather than tracked: the select below owns the
  // choice from here on, and re-reading the URL would overwrite a change the user
  // just made. An id that no longer exists is caught by FolderSelect.
  const [searchParams] = useSearchParams();
  const [folder, setFolder] = useState(searchParams.get("folder") || UNFILED);
  const [data, setData] = useState({
    title: "",
    content: "",
  });
  // Which of the two submit buttons is in flight — not a plain boolean, so only
  // the clicked button shows a spinner while both stay disabled.
  const [submitting, setSubmitting] = useState(null);
  const loading = submitting !== null;
  const navigate = useNavigate();

  // `encrypted` is the whole difference between the two buttons: the body is
  // sealed server-side before it is written, so the plaintext never lands in
  // Mongo. Decryption is transparent on read, so nothing else in the app cares.
  const createNote = async ({ encrypted }) => {
    const { title, content } = data;
    // The editor emits "<p></p>" for an empty document, so check the text.
    if (!title.trim() || isEmptyHtml(content)) {
      toast.error("All fields are required");
      return;
    }
    try {
      setSubmitting(encrypted ? "encrypted" : "plain");
      // Writes the new note into the cached listings on the way through, so the
      // page it navigates to below already has it and does not refetch. With no
      // connection it is queued instead and sent on reconnect — `queued` says
      // which happened, because "saved" means something different in each case.
      const { queued } = await saveNote(user._id, {
        title,
        content,
        folder,
        encrypted,
      });
      toast.success(
        queued
          ? "Saved on this device — it will sync when you're back online"
          : encrypted
            ? "Encrypted note created successfully"
            : "Note created successfully"
      );
      // Back to the folder the note went into, so a note created from a folder
      // page lands somewhere it is actually visible. Unfiled notes go home, where
      // the "all notes" grid shows everything.
      navigate(folder === UNFILED ? "/" : `/folder/${folder}`);
    } catch (error) {
      console.error("Error creating note:", error);
      if (isOfflineRefusal(error)) {
        // Nothing was attempted: an encrypted note needs the server's key, so it
        // cannot be queued without holding the plaintext on disk in the meantime.
        toast.error(error.message, { duration: 6000 });
      } else if (error.response && error.response.status === 429) {
        toast.error("Slow down, you are creating too many requests.", {
          duration: 5000,
          position: "top-center",
          icon: "🚨",
        });
      } else if (error.response?.status === 403) {
        // The account setting was turned off elsewhere — in another tab, or on
        // another device — after this page rendered its button.
        toast.error(
          error.response.data?.message ??
            "Encrypted notes are turned off for this account",
          { duration: 6000 }
        );
      } else if (error.response?.status === 503) {
        // The server has no encryption key, so it refused rather than saving the
        // note in the clear. Say so — retrying the same button will not help.
        toast.error(
          error.response.data?.message ??
            "Encrypted notes are not available right now",
          { duration: 6000 }
        );
      } else if (error.response?.status !== 401) {
        toast.error("Failed to create note");
      }
    } finally {
      setSubmitting(null);
    }
  };

  const handelSubmit = (e) => {
    e.preventDefault();
    // Enter in the title field submits the form; that is the plain create.
    createNote({ encrypted: false });
  };

  return (
    /* No `bg-base-200` here: an opaque page wrapper paints over the fixed
       background layer, and the glass then has nothing to be seen through. */
    <div className="min-h-screen">
      <div className="container mx-auto px-4 py-8">
        <div className="max-w-2xl mx-auto">
          <Button to="/" variant="ghost" icon={ArrowLeftIcon} className="mb-4">
            Back to Notes
          </Button>
          <div className="glass-panel-strong card">
            <div className="card-body">
              <h1 className="card-title text-2xl mb-4">Create New Notes</h1>
              <form onSubmit={handelSubmit}>
                <div className="form-control mb-4">
                  <label className="label">
                    <span className="label-text">Title</span>
                  </label>
                  <input
                    type="text"
                    placeholder="enter note title"
                    className="input input-bordered input-glass"
                    value={data.title}
                    onChange={(e) =>
                      setData({ ...data, title: e.target.value })
                    }
                    maxLength={200}
                    required
                  />
                </div>
                <FolderSelect
                  value={folder}
                  onChange={setFolder}
                  disabled={loading}
                />
                <div className="form-control mb-4">
                  <label className="label">
                    <span className="label-text">content</span>
                  </label>
                  <RichTextEditor
                    value={data.content}
                    onChange={(content) => setData({ ...data, content })}
                    placeholder="enter note content"
                  />
                </div>
                {canEncrypt && !isOnline && (
                  <div
                    className="alert mb-4 border border-warning/30 bg-warning/10 text-warning-content"
                    role="status"
                  >
                    <CloudOffIcon className="size-5 shrink-0" />
                    <span className="text-sm">
                      Encrypted notes can only be created while online. Their
                      contents are never kept in this device's offline queue.
                    </span>
                  </div>
                )}
                {/* Wraps on a narrow screen instead of squeezing two labels
                    onto one line. The encrypted action is the outline variant:
                    it is the deliberate choice, not the default one. */}
                <div className="card-actions flex-wrap justify-end gap-2">
                  {canEncrypt && (
                    <Button
                      type="button"
                      variant="outline-primary"
                      icon={LockIcon}
                      loading={submitting === "encrypted"}
                      disabled={loading || !isOnline}
                      onClick={() => createNote({ encrypted: true })}
                    >
                      {submitting === "encrypted"
                        ? "encrypting..."
                        : "create encrypted note"}
                    </Button>
                  )}
                  <Button
                    type="submit"
                    variant="primary"
                    loading={submitting === "plain"}
                    disabled={loading}
                  >
                    {submitting === "plain" ? "creating..." : "create note"}
                  </Button>
                </div>
              </form>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default CreatePage;
