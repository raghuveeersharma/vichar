import { CloudOffIcon } from "lucide-react";

/**
 * Shown where a page would normally have data but has none and cannot get any:
 * offline with nothing in the cache for this view.
 *
 * Deliberately not an error — nothing failed, the data is simply somewhere the
 * browser cannot reach right now — so it reads as a state, not a fault, and never
 * offers a retry button that could not work.
 */
const OfflineNotice = ({ message, title = "You're offline" }) => (
  <div className="glass-panel-strong mx-auto mt-8 flex max-w-md flex-col items-center justify-center space-y-5 px-6 py-12 text-center sm:px-10">
    <div className="rounded-full bg-base-content/10 p-6">
      <CloudOffIcon className="size-9 text-base-content/60" />
    </div>
    <h3 className="text-xl font-bold">{title}</h3>
    <p className="text-sm text-base-content/70">{message}</p>
  </div>
);

export default OfflineNotice;
