import toast from "react-hot-toast";
import api from "./axios";

// The `:folderId` value that means "notes in no folder". Matches the literal the
// API accepts for `?folder=`, so the route param can be forwarded as-is.
export const UNFILED = "unfiled";

export const fetchFolders = () => api.get("/folders").then((res) => res.data);

export const fetchFolder = (id) =>
  api.get(`/folders/${id}`).then((res) => res.data);

export const createFolder = (name) =>
  api.post("/folders", { name }).then((res) => res.data.folder);

export const renameFolder = (id, name) =>
  api.patch(`/folders/${id}`, { name }).then((res) => res.data.folder);

export const deleteFolder = (id) => api.delete(`/folders/${id}`);

// Shared because the interesting folder failures are all ones where the server's
// own message is better than anything the client could invent: 409 says either
// "you already have a folder with that name" or "this folder still has 3 notes",
// and both are exactly what the user needs to read. Only fall back to a generic
// message when there is nothing to quote.
export function reportFolderError(error, fallback) {
  console.error(`${fallback}:`, error);
  // 401 is handled globally by the axios interceptor, which clears the session
  // and lets ProtectedRoute redirect — a toast here would just be noise.
  if (error.response?.status === 401) return;
  if (error.response?.status === 429) {
    toast.error("Rate limit exceeded. Please try again later.");
    return;
  }
  toast.error(error.response?.data?.message || fallback);
}
