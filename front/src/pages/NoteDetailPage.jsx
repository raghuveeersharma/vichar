import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router";
import api from "../libs/axios";
import {
  ArrowLeftIcon,
  CheckIcon,
  CopyIcon,
  LoaderIcon,
  LockIcon,
  Trash2,
} from "lucide-react";
import toast from "react-hot-toast";
import RichTextEditor from "../components/RichTextEditor";
import { htmlToText, isEmptyHtml, toEditorHtml } from "../libs/html";
import Button from "../components/Button";
import FolderSelect from "../components/FolderSelect";
import { UNFILED } from "../libs/folders";

const NoteDetailPage = () => {
  const navigate = useNavigate();
  const { id } = useParams();
  const [saving, setSaving] = useState(false);
  const [copied, setCopied] = useState(false);
  const [data, setData] = useState({
    title: "",
    content: "",
  });
  const [loading, setLoading] = useState(true);
  useEffect(() => {
    const fetchNote = async () => {
      try {
        const res = await api.get(`/notes/${id}`);
        // Notes saved before the rich-text editor are plain text — promote
        // them to HTML so their line breaks survive the round trip.
        // `folder` is null for an unfiled note; the select speaks in the UNFILED
        // sentinel, and the save path maps it back.
        setData({
          ...res.data,
          content: toEditorHtml(res.data.content),
          folder: res.data.folder ?? UNFILED,
        });
      } catch (error) {
        console.error("Error fetching notes:", error);
        if (error.response && error.response.status === 429) {
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
          toast.error(
            error.response.data?.message ?? "Failed to fetch notes"
          );
          navigate("/", { replace: true });
        } else if (error.response?.status !== 401) {
          toast.error("Failed to fetch notes");
        }
      } finally {
        setLoading(false);
      }
    };
    fetchNote();
  }, [id, navigate]);

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
    if (!window.confirm("Are you sure you want to delete this note?")) return;
    try {
      await api.delete(`/notes/${id}`);
      toast.success("Note deleted successfully");
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
    if (!data.title.trim() || isEmptyHtml(data.content)) {
      toast.error("All fields are required");
      return;
    }
    setSaving(true);
    try {
      await api.put(`/notes/${id}`, data);
      toast.success("Note updated successfully");
      navigate("/"); // only on success, so a failed save keeps the user's edits
    } catch (error) {
      console.error("Error updating note:", error);
      if (error.response && error.response.status === 429) {
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
                onClick={handelDelete}
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
                    onChange={(e) =>
                      setData({ ...data, title: e.target.value })
                    }
                    required
                  />
                </div>
                {/* Changing this moves the note: the save below sends `folder`
                    alongside the body, and the API only reassigns a note when the
                    request actually carries that key. */}
                <FolderSelect
                  value={data.folder ?? UNFILED}
                  onChange={(folder) => setData({ ...data, folder })}
                  disabled={saving}
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
                <div className="card-actions justify-end">
                  <Button
                    type="submit"
                    variant="primary"
                    loading={saving}
                  >
                    {saving ? "Saving..." : "Save Changes"}
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

export default NoteDetailPage;
