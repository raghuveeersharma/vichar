import { useEffect, useState } from "react";
import { Link, useNavigate, useParams } from "react-router";
import api from "../libs/axios";
import { ArrowLeftIcon, LoaderIcon, Trash2 } from "lucide-react";
import toast from "react-hot-toast";

const NoteDetailPage = () => {
  const navigate = useNavigate();
  const { id } = useParams();
  const [saving, setSaving] = useState(false);
  const [data, setData] = useState({
    title: "",
    content: "",
  });
  const [loading, setLoading] = useState(true);
  useEffect(() => {
    const fetchNote = async () => {
      try {
        const res = await api.get(`/notes/${id}`);
        setData(res.data);
        console.log(res.data);
      } catch (error) {
        console.error("Error fetching notes:", error);
        if (error.response && error.response.status === 429) {
          toast.error("Rate limit exceeded. Please try again later.");
        } else if (error.response?.status === 404) {
          // Either the note is gone or it belongs to another user — the API
          // does not distinguish the two on purpose.
          toast.error("Note not found");
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
      <div className="min-h-screen bg-base-200 flex items-center justify-center">
        <LoaderIcon className="animate-spin size-10" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-base-200">
      <div className="container mx-auto px-4 py-8 ">
        <div className="max-w-2xl mx-auto">
          {" "}
          <div className="flex items-center justify-between">
            <Link to={"/"} className="btn btn-ghost">
              <ArrowLeftIcon className="size-5" />
              Back to Notes
            </Link>
            <button
              className="btn btn-error btn-outline"
              onClick={handelDelete}
            >
              <Trash2 className="size-5" />
              Delete Note
            </button>
          </div>
          <div className="card bg-base-100 mt-4">
            <div className="card-body">
              <h1 className="card-title text-2xl mb-4">Create New Notes</h1>
              <form onSubmit={(e) => handelSubmit(e, id)}>
                <div className="form-control mb-4">
                  <label className="label">
                    <span className="label-text">Title</span>
                  </label>
                  <input
                    type="text"
                    placeholder="enter note title"
                    className="input input-bordered"
                    value={data.title}
                    onChange={(e) =>
                      setData({ ...data, title: e.target.value })
                    }
                    required
                  />
                </div>
                <div className="form-control mb-4">
                  <label className="label">
                    <span className="label-text">content</span>
                  </label>
                  <textarea
                    placeholder="enter note content"
                    type="text"
                    className="textarea textarea-bordered h-32"
                    value={data.content}
                    onChange={(e) =>
                      setData({ ...data, content: e.target.value })
                    }
                    required
                  />
                </div>
                <div className="card-actions justify-end">
                  <button
                    type="submit"
                    className="btn btn-primary"
                    disabled={saving}
                  >
                    {loading ? "Saving..." : "Save Changes"}
                  </button>
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
