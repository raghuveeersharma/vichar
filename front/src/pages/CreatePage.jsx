import { ArrowLeftIcon, LockIcon } from "lucide-react";
import { useState } from "react";
import toast from "react-hot-toast";
import api from "../libs/axios";
import { useNavigate } from "react-router";
import RichTextEditor from "../components/RichTextEditor";
import { isEmptyHtml } from "../libs/html";
import Button from "../components/Button";

const CreatePage = () => {
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
      await api.post("/notes", { ...data, encrypted });
      toast.success(
        encrypted
          ? "Encrypted note created successfully"
          : "Note created successfully"
      );
      navigate("/");
    } catch (error) {
      console.error("Error creating note:", error);
      if (error.response && error.response.status === 429) {
        toast.error("Slow down, you are creating too many requests.", {
          duration: 5000,
          position: "top-center",
          icon: "🚨",
        });
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
                  />
                </div>
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
                {/* Wraps on a narrow screen instead of squeezing two labels
                    onto one line. The encrypted action is the outline variant:
                    it is the deliberate choice, not the default one. */}
                <div className="card-actions flex-wrap justify-end gap-2">
                  <Button
                    type="button"
                    variant="outline-primary"
                    icon={LockIcon}
                    loading={submitting === "encrypted"}
                    disabled={loading}
                    onClick={() => createNote({ encrypted: true })}
                  >
                    {submitting === "encrypted"
                      ? "encrypting..."
                      : "create encrypted note"}
                  </Button>
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
