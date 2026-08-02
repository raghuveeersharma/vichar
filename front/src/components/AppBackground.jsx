/**
 * The fixed backdrop every glass panel is seen through — glass only reads as
 * glass when there is something behind it. Mounted once at the root; all of
 * the styling lives in `.app-bg*` in index.css so the blob colors stay tied to
 * the daisyUI theme variables and the reduced-motion / reduced-transparency
 * fallbacks sit next to the tokens they override.
 *
 * `aria-hidden` because it is pure decoration, and `.app-bg` is
 * pointer-events-none so it never intercepts a click.
 */
const AppBackground = () => (
  <div className="app-bg" aria-hidden="true">
    <div className="app-bg-blob app-bg-blob-a" />
    <div className="app-bg-blob app-bg-blob-b" />
    <div className="app-bg-blob app-bg-blob-c" />
  </div>
);

export default AppBackground;
