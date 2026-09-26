# Vichar frontend

The Vichar frontend is a React 19 single-page application built with Vite. It
is independently deployed from the Express API, normally to a static host with
SPA fallback (the included `vercel.json` config supplies this for Vercel).

## Setup

```bash
npm install
cp .env.example .env
npm run dev
```

Set the required API base URL in `.env`:

```dotenv
VITE_SERVER_URL="http://localhost:5000/api"
```

The value must include `/api`. The shared axios client sends cookies with every
request, so the backend's `CORS_ORIGIN` must exactly match the frontend origin.

## Commands

```bash
npm run dev        # local Vite server
npm run build      # production bundle in dist/
npm run preview    # serve the built bundle locally
npm run lint       # ESLint
npm run test:a11y  # Playwright + axe checks (requires Chromium)
```

Install the browser once before running accessibility tests locally:

```bash
npx playwright install chromium
```

## Architecture

- `src/pages/` contains route-level pages, lazily loaded by `App.jsx`.
- `src/context/AuthContext.jsx` owns cookie-session rehydration, public user
  state, and authenticated account actions. The JWT itself stays in an httpOnly
  cookie and is never exposed to JavaScript.
- `src/libs/` contains the API client plus IndexedDB cache and offline outbox.
  API responses are not stored in the service-worker Cache API.
- `src/hooks/useCachedQuery.js` is the cache-first read layer. Writes update
  both the in-memory view and the owner-scoped IndexedDB records.
- `src/components/RichTextEditor.jsx` contains TipTap editing, Gemini actions,
  and browser speech-recognition integration.

The PWA service worker precaches only the application shell. It does not cache
API responses, so cookie-protected data cannot outlive its authorization.
Encrypted note bodies are deliberately withheld from IndexedDB; they require a
network connection to read and edit.

## Testing boundaries

`tests/accessibility.spec.js` checks public account pages for automatically
detectable WCAG 2/2.1 AA issues. It complements, but does not replace, manual
keyboard, screen-reader, editor, offline, PWA-install, and device testing.
