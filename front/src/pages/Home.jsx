import { useEffect, useState } from "react";
import RateLimitUI from "../components/RateLimitUI";
import api from "../libs/axios";
import { toast } from "react-hot-toast";
import NoteCard from "../components/NoteCard";
import NotesNotFound from "../components/NotesNotFound";

const Home = () => {
  const [isRateLimit, setIsRateLimit] = useState(false);
  const [notes, setNotes] = useState([]);
  const [loading, setLoading] = useState(false);
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
        } else {
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
      <div className="mx-auto max-w-6xl p-4 mt-6">
        {loading && <div className="text-primary text-lg ">Loading...</div>}
        {!isRateLimit && notes.length === 0 && !loading && <NotesNotFound />}
        {notes.length > 0 && !isRateLimit && (
          <div className="grid geid-col-1 md:grid-col-2 lg:grid-cols-3 gap-4">
            {notes.map((note) => (
              <NoteCard key={note._id} note={note} setNotes={setNotes} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default Home;
