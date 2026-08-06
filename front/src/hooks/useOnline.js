import { useEffect, useState } from "react";

/**
 * Whether the browser thinks it has a connection.
 *
 * `navigator.onLine` is only trustworthy in one direction: false definitely means
 * no network, true only means "there is an interface up", not that the API is
 * reachable. So it is used to *skip* requests that cannot possibly succeed, never
 * to assume one will — a request made while it reads true still fails normally and
 * is handled by the caller's own error path.
 */
export default function useOnline() {
  const [online, setOnline] = useState(() => navigator.onLine !== false);

  useEffect(() => {
    const up = () => setOnline(true);
    const down = () => setOnline(false);
    window.addEventListener("online", up);
    window.addEventListener("offline", down);
    // The events can fire between the initial state and this effect running.
    setOnline(navigator.onLine !== false);
    return () => {
      window.removeEventListener("online", up);
      window.removeEventListener("offline", down);
    };
  }, []);

  return online;
}
