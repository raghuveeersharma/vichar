import { useEffect, useState } from "react";
import { LoaderIcon } from "lucide-react";
import RateLimitUI from "../components/RateLimitUI";
import api from "../libs/axios";
import { toast } from "react-hot-toast";
import NoteCard from "../components/NoteCard";
import NotesNotFound from "../components/NotesNotFound";
import FolderList from "../components/FolderList";

const Home = () => {
  const [isRateLimit, setIsRateLimit] = useState(false);
  const [notes, setNotes] = useState([]);
  // Starts true so the "no notes yet" empty state does not flash before the
  // first fetch resolves.
  const [loading, setLoading] = useState(true);
  useEffect(() => {
    const fetchNotes = async () => {
      try {
        setLoading(true);
        const res = await api.get("/notes");
        setNotes(res.data);
        console.log(res.data);
      } catch (error) {
        console.error("Error fetching notes:", error);
        if (error.response && error.response.status === 429) {
          setIsRateLimit(true);
        } else if (error.response?.status !== 401) {
          // 401 is handled globally by the axios interceptor, which signs the
          // user out and lets ProtectedRoute redirect to /login.
          toast.error("Failed to fetch notes");
        }
      } finally {
        setLoading(false);
      }
    };
    fetchNotes();
  }, []);

  return (
    <div>
      {isRateLimit && <RateLimitUI />}
      <div className="mx-auto mt-6 max-w-6xl px-4 py-4">
        {/* Folders own their own fetch and render nothing until it settles, so
            they never delay or block the note grid below. Hidden under a rate
            limit, where the banner has already explained why the page is bare. */}
        {!isRateLimit && <FolderList />}
        {loading && (
          <div className="flex items-center justify-center gap-2 py-16 text-primary">
            <LoaderIcon className="size-5 animate-spin" />
            <span>Loading...</span>
          </div>
        )}
        {!isRateLimit && notes.length === 0 && !loading && <NotesNotFound />}
        {notes.length > 0 && !isRateLimit && (
          <>
            {/* "All notes", not "Notes": this grid is every note the user owns,
                including the ones inside the folders listed above. Folders
                narrow the view, they do not partition it. */}
            <h2 className="mb-3 text-lg font-semibold text-base-content/90">
              All notes
            </h2>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 lg:gap-6 xl:grid-cols-4">
              {notes.map((note) => (
                <NoteCard key={note._id} note={note} setNotes={setNotes} />
              ))}
            </div>
          </>
        )}
      </div>
    </div>
  );
};

export default Home;
