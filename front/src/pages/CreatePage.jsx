import { ArrowLeftIcon } from "lucide-react";
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
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  const handelSubmit = async (e) => {
    e.preventDefault();
    const { title, content } = data;
    try {
      setLoading(true);
      // The editor emits "<p></p>" for an empty document, so check the text.
      if (!title.trim() || isEmptyHtml(content)) {
        toast.error("All fields are required");
        return;
      }
      const res = await api.post("/notes", data);
      console.log(res.data);
      toast.success("Note created successfully");
      navigate("/");
    } catch (error) {
      console.error("Error creating note:", error);
      setLoading(false);
      if (error.response && error.response.status === 429) {
        toast.error("Slow down, you are creating too many requests.", {
          duration: 5000,
          position: "top-center",
          icon: "🚨",
        });
      } else {
        toast.error("Failed to create note");
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-base-200">
      <div className="container mx-auto px-4 py-8">
        <div className="max-w-2xl mx-auto">
          <Button to="/" variant="ghost" icon={ArrowLeftIcon} className="mb-4">
            Back to Notes
          </Button>
          <div className="card bg-base-100">
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
                <div className="card-actions justify-end">
                  <Button
                    type="submit"
                    variant="primary"
                    loading={loading}
                  >
                    {loading ? "creating..." : "create note"}
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
