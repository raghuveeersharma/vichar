import { useEffect, useState } from "react";
import { useRegisterSW } from "virtual:pwa-register/react";
import toast from "react-hot-toast";
import { DownloadIcon, ShareIcon, XIcon } from "lucide-react";
import Button from "./Button";

// Remembers a dismissal so the banner does not reappear on every visit. Only
// the "not now" path writes it — an actual install removes the banner for good
// because the browser stops firing `beforeinstallprompt` once installed.
const DISMISSED_KEY = "vichar:install-dismissed";

// Every iOS browser is WebKit underneath, so the check is by platform, not by
// browser — Chrome and Firefox on an iPhone need the same manual flow Safari
// does. iPadOS 13+ reports a desktop UA, hence the touch-points fallback: it is
// the only "Macintosh" with a touchscreen.
const isIos = () =>
  /iphone|ipad|ipod/i.test(navigator.userAgent) ||
  (/macintosh/i.test(navigator.userAgent) && navigator.maxTouchPoints > 1);

const isStandalone = () =>
  window.matchMedia("(display-mode: standalone)").matches ||
  // The non-standard iOS flag — Safari still has no display-mode support in
  // every version we care about.
  window.navigator.standalone === true;

/**
 * The two service-worker-shaped pieces of UI: a toast when a new build is
 * waiting, and a banner offering to install the app.
 *
 * Mounted once, next to <Toaster />, rather than inside a page — the install
 * event can fire at any moment, including on a route the user is about to
 * leave.
 */
const PWAPrompts = () => {
  const {
    needRefresh: [needRefresh],
    updateServiceWorker,
  } = useRegisterSW();

  // The deferred `beforeinstallprompt` event. Held rather than called straight
  // away: `prompt()` only works from a user gesture, and only once.
  const [installEvent, setInstallEvent] = useState(null);
  const [showIosHint, setShowIosHint] = useState(false);

  // A waiting worker means the assets for a newer build are already downloaded;
  // the reload is instant. It is offered rather than applied because
  // `updateServiceWorker(true)` reloads the tab, which would discard an
  // unsaved note.
  useEffect(() => {
    if (!needRefresh) return;

    const id = toast(
      (t) => (
        <span className="flex items-center gap-3">
          <span className="text-sm">A new version is available.</span>
          <button
            className="btn btn-primary btn-xs"
            onClick={() => {
              toast.dismiss(t.id);
              updateServiceWorker(true);
            }}
          >
            reload
          </button>
        </span>
      ),
      { duration: Infinity, id: "sw-update" }
    );

    return () => toast.dismiss(id);
  }, [needRefresh, updateServiceWorker]);

  useEffect(() => {
    if (isStandalone() || localStorage.getItem(DISMISSED_KEY)) return;

    // Safari never fires `beforeinstallprompt` and has no programmatic install,
    // so iOS gets the manual Share → Add to Home Screen instructions instead.
    if (isIos()) {
      setShowIosHint(true);
      return;
    }

    const onPrompt = (e) => {
      // Without this the browser shows its own mini-infobar instead of letting
      // us defer to the button below.
      e.preventDefault();
      setInstallEvent(e);
    };
    const onInstalled = () => setInstallEvent(null);

    window.addEventListener("beforeinstallprompt", onPrompt);
    window.addEventListener("appinstalled", onInstalled);
    return () => {
      window.removeEventListener("beforeinstallprompt", onPrompt);
      window.removeEventListener("appinstalled", onInstalled);
    };
  }, []);

  const dismiss = () => {
    localStorage.setItem(DISMISSED_KEY, "1");
    setInstallEvent(null);
    setShowIosHint(false);
  };

  const install = async () => {
    if (!installEvent) return;
    installEvent.prompt();
    await installEvent.userChoice;
    // The event is single-use whatever the user chose; a second `prompt()` on
    // it throws.
    setInstallEvent(null);
  };

  if (!installEvent && !showIosHint) return null;

  return (
    <div className="fixed inset-x-0 bottom-0 z-50 p-3 sm:p-4">
      <div className="glass-panel-strong mx-auto flex max-w-md items-center gap-3 p-3 sm:p-4">
        <div className="flex-shrink-0 rounded-full bg-primary/10 p-2">
          <DownloadIcon className="size-5 text-primary" />
        </div>

        <div className="min-w-0 flex-1">
          <p className="text-sm font-semibold">Install Vichar</p>
          {showIosHint ? (
            <p className="mt-0.5 flex flex-wrap items-center gap-1 text-xs text-base-content/70">
              Tap
              <ShareIcon className="inline size-3.5" />
              then &ldquo;Add to Home Screen&rdquo;.
            </p>
          ) : (
            <p className="mt-0.5 text-xs text-base-content/70">
              Add it to your home screen for a full-screen app.
            </p>
          )}
        </div>

        {!showIosHint && (
          <Button size="xs" variant="primary" onClick={install}>
            install
          </Button>
        )}
        <Button
          size="xs"
          variant="ghost"
          square
          icon={XIcon}
          onClick={dismiss}
          aria-label="Dismiss install prompt"
        />
      </div>
    </div>
  );
};

export default PWAPrompts;
