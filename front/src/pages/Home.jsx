import { LoaderIcon } from "lucide-react";
import RateLimitUI from "../components/RateLimitUI";
import api from "../libs/axios";
import { toast } from "react-hot-toast";
import NoteCard from "../components/NoteCard";
import NotesNotFound from "../components/NotesNotFound";
import FolderList from "../components/FolderList";
import OfflineNotice from "../components/OfflineNotice";
import useCachedQuery from "../hooks/useCachedQuery";
import { NOTES_ALL } from "../libs/cache";

const Home = () => {
  // Cache-first: a cached listing renders immediately and is only refreshed from
  // the network once it falls outside the stale window, so moving between the home
  // page and a note no longer costs a request each way. `setNotes` still writes
  // through to the cache, which is what lets NoteCard splice a deleted note out.
  const {
    data,
    loading,
    error,
    offline,
    setData: setNotes,
  } = useCachedQuery(NOTES_ALL, () => api.get("/notes").then((res) => res.data), {
    onError: (err, { cached }) => {
      console.error("Error fetching notes:", err);
      // 429 has its own banner below, 401 is handled globally by the axios
      // interceptor, and a failed refresh behind a cached list is not worth
      // interrupting anyone over — the notes are on screen.
      if (err.response?.status === 429) return;
      if (err.response?.status === 401 || cached) return;
      if (err.response) toast.error("Failed to fetch notes");
    },
  });

  const notes = data ?? [];
  const isRateLimit = error?.response?.status === 429;
  // Offline with nothing stored: there is no listing to show and no way to get
  // one, which is a different situation from "you have no notes yet".
  const isOfflineEmpty = offline && data == null;

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
        {isOfflineEmpty && !loading && (
          <OfflineNotice message="Your notes have not been saved for offline use on this device yet. Open the app once with a connection and they will be here next time." />
        )}
        {!isRateLimit && !isOfflineEmpty && notes.length === 0 && !loading && (
          <NotesNotFound />
        )}
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
