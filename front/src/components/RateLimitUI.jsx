import { ZapIcon } from "lucide-react";
const RateLimitUI = () => {
  return (
    <div className="mx-auto max-w-6xl px-4 py-8">
      {/* Warning-tinted border so this is distinguishable from an ordinary
          panel at a glance — every other surface carries the neutral one. */}
      <div className="glass-panel border-warning/30">
        <div className="flex flex-col items-center p-6 md:flex-row">
          <div className="mb-4 flex-shrink-0 rounded-full bg-warning/20 p-4 md:mb-0 md:mr-6">
            <ZapIcon className="size-10 text-warning" />
          </div>
          <div className="flex-1 text-center md:text-left">
            <h3 className="mb-2 text-xl font-bold">Rate Limit Reached</h3>
            <p className="mb-1 text-base-content">
              You've made too many requests in a short period. Please wait a
              moment.
            </p>
            <p className="text-sm text-base-content/70">
              Try again in a few seconds for the best experience.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default RateLimitUI;
