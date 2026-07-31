import axios from "axios";

const api = axios.create({
  baseURL: import.meta.env.VITE_SERVER_URL,
  // The auth token lives in an httpOnly cookie, so every request must opt in to
  // sending credentials cross-origin.
  withCredentials: true,
});

export default api;
