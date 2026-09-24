# Vichar

A multi-tenant notes app with a rich-text editor, folders, opt-in per-note encryption, AI editing actions, and full offline support as an installable PWA.

Tenancy is per-user: every note and folder carries an `owner`, and a user can only ever see or modify their own.

## Features

- **Rich text notes** — TipTap editor; note bodies are stored as HTML.
- **Safe rich text** — stored notes and AI replies are sanitised to the editor's supported HTML before they can be rendered.
- **Folders** — flat, per-user, with unique (case-insensitive) names. Notes are optionally filed into one folder; everything else is "Unfiled".
- **Encrypted notes (opt-in)** — AES-256-GCM at the storage boundary, enabled per account in Settings. Decryption is transparent, so the rest of the app only ever sees plaintext.
- **AI editing** — two one-shot Gemini actions from the editor toolbar: fix grammar, and reformat. Nothing is persisted unless you save.
- **Voice dictation** — a mic button in the editor toolbar transcribes speech into the note at the cursor, using the browser's built-in Web Speech API. No backend, no API key. Chrome and Edge; unsupported in Firefox, where the button explains itself rather than failing.
- **Works offline** — reads are served cache-first from IndexedDB; note writes made offline are queued and replayed on reconnect.
- **Installable PWA** — service worker precaches the app shell (never API responses), with an update prompt and an install banner.
- **Cookie auth** — the JWT lives in an httpOnly cookie and is never touched by JavaScript.
- **CSRF protection** — every state-changing API request must have an `Origin` exactly matching `CORS_ORIGIN`.

## Repository layout

Two independently-deployed packages in one repo. There is no root `package.json` or workspace tooling — install and run each package separately.

```
vichar/
├── front/     React 19 + Vite SPA        (deployed to Vercel)
└── server/    Express 5 + Mongoose API
```

## Tech stack

| | |
|---|---|
| Frontend | React 19, Vite 7, React Router 7, Tailwind CSS 3 + daisyUI (`forest` theme), TipTap 3, axios, react-hot-toast, lucide-react, vite-plugin-pwa |
| Backend | Node.js, Express 5, Mongoose 8 (MongoDB), jsonwebtoken, bcryptjs, cookie-parser, cors, express-rate-limit |
| AI | Google Gemini via `@google/genai` |
| Speech | Web Speech API (`SpeechRecognition`) — built into the browser, so no dependency, service or key |
| Storage (client) | IndexedDB for the offline cache and the write outbox |

## Getting started

### Prerequisites

- Node.js 18+
- A MongoDB instance (local or Atlas)
- Optionally, a [Google AI Studio API key](https://aistudio.google.com/apikey) for the AI actions

### 1. Backend

```bash
cd server
npm install
cp .env.example .env      # then fill in the values below
npm run dev               # nodemon src/index.js  → http://localhost:5000
```

### 2. Frontend

```bash
cd front
npm install
echo 'VITE_SERVER_URL="http://localhost:5000/api"' > .env
npm run dev               # → http://localhost:5173
```

## Environment variables

Both packages read from their own `.env`, which is gitignored.

### `server/.env`

| Variable | Required | Notes |
|---|---|---|
| `PORT` | no | Defaults to `5000`. |
| `MONGODB_URI` | **yes** | The connection is awaited before `app.listen`, so a bad URI means the server never binds a port. |
| `CORS_ORIGIN` | **yes** | The frontend's **exact** origin — not a wildcard. `cors` runs with `credentials: true`, and browsers reject `*` on credentialed requests, which silently breaks auth. It is also required by the CSRF Origin check on every `POST`, `PUT`, `PATCH`, and `DELETE` API request. |
| `JWT_SECRET` | **yes** | Missing value exits the process at boot rather than failing per request. Changing it invalidates every existing session. |
| `NODE_ENV` | no | `production` switches the auth cookie to `Secure` + `SameSite=None`, required when the SPA and API are on different domains. |
| `NOTE_ENCRYPTION_KEY` | no | Must decode to exactly 32 bytes (`openssl rand -hex 32`, or base64) — anything else throws rather than being padded. Without it, everything works except creating an encrypted note, which answers `503`. |
| `GEMINI_API_KEY` | no | Without it the server still boots and `/api/ai/*` answers `503`. |
| `GEMINI_MODEL` | no | Overrides the default `gemini-3.6-flash`. |
| `SMTP_HOST`, `SMTP_PORT`, `EMAIL_FROM` | **yes** | SMTP host, port, and sender for account-verification email. The server refuses to start without them. |
| `SMTP_USER`, `SMTP_PASSWORD` | usually | SMTP credentials. Both may be omitted only for a trusted unauthenticated relay. |

> **Back up `NOTE_ENCRYPTION_KEY` outside `.env`.** Changing or losing it makes every existing encrypted note permanently unreadable, and it must be identical across any environments sharing a database.

### `front/.env`

| Variable | Required | Notes |
|---|---|---|
| `VITE_SERVER_URL` | **yes** | Must include the `/api` suffix, e.g. `http://localhost:5000/api` — it is used as the axios `baseURL` and callers request paths like `/notes`. |

The example file lives at `front/.env.example`, where Vite loads `.env` from.

## Scripts

```bash
# server/
npm run dev        # nodemon src/index.js
npm start          # node src/index.js
npm test           # API integration tests (ephemeral MongoDB)

# front/
npm run dev        # vite dev server
npm run build      # production build → dist/
npm run preview    # serve the production build
npm run lint       # eslint .
```

`npm test` in `server/` runs API integration tests against an ephemeral MongoDB. They
cover CSRF origin enforcement, cookie authentication, rich-text sanitisation,
and note tenant isolation. CI runs those tests plus the frontend lint and build
on every pull request and push.

## Rich-text safety policy

Notes may contain only the structure the editor supports: paragraphs, headings,
basic inline marks, code/preformatted text, blockquotes, ordered/unordered
lists, links, horizontal rules, and line breaks. Links may have only `http`,
`https`, or `mailto` `href` values. All other tags and attributes — including
scripts, embedded media, inline styles, event handlers, and `javascript:` URLs
— are removed on note create/update and from AI responses before they reach the
browser. Existing legacy content is also cleaned before being sent to Gemini.

## API

Base path `/api`. Auth is a JWT in an httpOnly cookie, so requests must be made with credentials.

### `/api/auth`

| Method | Path | Auth | Description |
|---|---|---|---|
| `POST` | `/signup` | — | Create an account (name, email, password). |
| `POST` | `/login` | — | Sets the auth cookie. One message for both unknown email and wrong password. |
| `POST` | `/logout` | — | Clears the auth cookie. |
| `POST` | `/verify-email` | — | Consumes a signed, one-use verification token. |
| `POST` | `/email-verification/resend` | ✔ | Sends a replacement verification link; three per hour per account. |
| `GET` | `/me` | ✔ | The current session user. The SPA calls this on boot. |
| `PATCH` | `/email` | ✔ | Re-verifies the current password. |
| `PATCH` | `/password` | ✔ | Re-verifies the current password. |
| `PATCH` | `/preferences` | ✔ | e.g. `encryptedNotesEnabled`. |

### `/api/notes` (all guarded)

| Method | Path | Description |
|---|---|---|
| `GET` | `/?folder=<id\|unfiled>` | All notes; the optional param narrows the listing. No param returns everything, including notes inside folders. |
| `POST` | `/` | Create. `encrypted: true` seals the body (requires the account preference, else `403`). |
| `GET` | `/:id` | One note. |
| `PUT` | `/:id` | Update. Only reassigns the folder when the body actually contains a `folder` key. |
| `DELETE` | `/:id` | Delete. |

### `/api/folders` (all guarded)

| Method | Path | Description |
|---|---|---|
| `GET` | `/` | All folders, with note counts. |
| `POST` | `/` | Create. Duplicate names → `409` (the unique index surfaces it, case-insensitively). |
| `GET` | `/:id` | One folder. |
| `PATCH` | `/:id` | Rename. |
| `DELETE` | `/:id` | Refused with `409` while the folder still holds notes. |

### `/api/ai` (guarded + rate-limited)

| Method | Path | Description |
|---|---|---|
| `POST` | `/grammar` | Proofread the note body. HTML in, HTML out. |
| `POST` | `/format` | Restructure the note body. HTML in, HTML out. |

### Deployment probes

These endpoints are outside `/api`, require neither authentication nor an
`Origin` header, and are not rate-limited. They return only service status, so
they are safe for deployment platforms and uptime monitors.

| Method | Path | Success response | Failure response | Purpose |
|---|---|---|---|---|
| `GET` | `/health` | `200 { "status": "ok" }` | — | Liveness: the Node process can serve HTTP. |
| `GET` | `/ready` | `200 { "status": "ready" }` | `503 { "status": "not_ready" }` | Readiness: MongoDB is currently connected and the API can serve database-backed traffic. |

### Conventions

- Another user's document returns **404, not 403**, so responses never confirm that an id exists.
- Validation failures → `400`, missing documents → `404`, unexpected errors → `500 { message: "Internal server error" }`.
- Every response includes a server-generated `X-Request-Id`. Include it in a support report so the matching request and error logs can be found.
- Requests are capped at 256 KB. Names are limited to 100 characters; emails to 254; passwords to 72 UTF-8 bytes; note titles to 200 characters; folder names to 60 characters; and note HTML to 128 KB. Oversized request bodies and note HTML return `413`.
- Rate limiting is global: **50 requests / 15 min per IP**, applied before the auth routes. Login also has dedicated limits of **10 / 15 min per IP** and **5 / 15 min per email address**; the limits stack. `/api/ai` adds a tighter **15 / 15 min** limiter on top — the two stack, so 15 is a ceiling.

## Architecture

### Backend

A flat three-layer flow: route → controller → model.

```
server/src/
├── index.js          entry: JWT guard → cors → rate limit → json → cookies → routers → db().then(listen)
├── config/db.js
├── libs/             token.js (JWT + cookie flags) · noteCrypto.js (AES-256-GCM) · gemini.js · logger.js
├── routes/           auth · notes · folders · ai
├── controllers/      one file per resource
├── modals/           user · note · folder      ("models", misspelled)
└── middlewear/       protect · requestLogger · rateLimiter · aiRateLimiter   ("middleware", misspelled)
```

Notable decisions:

- **Tenant isolation lives in the query, not in a check.** Handlers use `findOne({ _id: id, owner })` rather than fetching by id and comparing afterwards. A bare `findById` in a resource controller is a cross-tenant leak.
- **Route guards are mounted at the router level** (`app.use("/api/notes", protect, router)`), so a newly added route cannot forget one.
- **Logs are JSON lines.** Each completed request logs a generated request id, method, path, status, duration, and authenticated user id when available. Internal failures add a structured error event with the same id. Request bodies, note content, credentials, cookies, tokens, keys, and email fields are never logged.
- **Passwords are hashed by a `pre("save")` hook**, so assigning plaintext and saving is always correct — never hash at the call site. `password` is `select: false`.
- **Encryption is per-note and applied only at the storage boundary.** The stored `isEncrypted` flag is the only authority; the owner id is the GCM additional authenticated data, so a ciphertext moved between rows fails its tag check. A body that will not open is a placeholder in listings but a `500` on the single-note read, because that response populates the edit form.

### Frontend

```
front/src/
├── main.jsx · App.jsx        BrowserRouter > AuthProvider > App; routes split into GuestRoute / ProtectedRoute
├── context/                  AuthProvider: session state, localStorage mirror, global 401 interceptor
├── hooks/                    useCachedQuery (cache-first read) · useOnline · useSpeechToText
├── pages/                    Home · FolderPage · CreatePage · NoteDetailPage · Login · Signup · Settings
├── components/               RichTextEditor · folder UI · dialogs · Navbar · route guards · SyncStatus · PWAPrompts
└── libs/                     axios · idb · cache · outbox · notes · folders · html · utils
```

Notable decisions:

- **No data-fetching library.** Reads go through `useCachedQuery`, writes through `libs/notes.js`; both call one shared axios instance. `AuthContext` is the only global state.
- **Reads are cache-first, and the cache is app state — not the service worker.** Entries live in IndexedDB stamped with the owner they were fetched for, and are destroyed on logout. No API response is ever put in the Cache API, because a cached *response* outlives the cookie that authorised it.
- **An encrypted note's body is never written to disk.** The client has no key to re-seal it, so the cache stores it as withheld and the editor refuses to open it rather than risk saving over the ciphertext.
- **Note writes survive being offline.** Offline mutations patch the cache and append to an outbox that `SyncStatus` replays on reconnect. Queued writes collapse (create + edit → one create), a `local:` id is never sent in a URL, and replay distinguishes retryable failures (stop, keep the queue) from final `4xx` ones (drop that item and report it). Encrypted notes are refused offline rather than queued — queueing would park plaintext in IndexedDB. Folder writes require a connection.
- **IndexedDB is treated as optional.** A cache that cannot open degrades to no cache, never to a broken app.
- **Dictation commits only finalised speech.** `useSpeechToText` runs recognition in continuous + interim mode and keeps the two apart: a final transcript is inserted at the cursor through the normal TipTap command pipeline (so it is undoable, and saved only when the user saves), while in-progress text is exposed for a read-only preview and never written to the document — interim results are rewritten as more audio arrives, so committing them would put words in the note that were never said. Recognition is not local, so it is refused offline; unsupported browsers and denied mic permission both surface as a toast rather than a dead button.
- **The PWA precaches the shell only**, and uses `registerType: "prompt"` so a new worker never reloads the tab out from under the editor.
- Styling is Tailwind + daisyUI locked to the `forest` theme — use semantic classes (`text-primary`, `base-content`) rather than raw colors. Destructive actions confirm through `ConfirmDialog`, never `window.confirm`.

## Deployment

- **Frontend → Vercel.** `vercel.json` rewrites all paths to `/` for SPA deep links; Vercel checks the filesystem first, so `/sw.js` and `/manifest.webmanifest` are still served correctly. Any other host needs the same behaviour or service-worker registration fails.
- **Backend → any Node host.** Set `NODE_ENV=production` so the auth cookie is `Secure` + `SameSite=None`, and set `CORS_ORIGIN` to the deployed frontend's exact origin. `trust proxy` is already enabled for TLS-terminating platforms.
- **Health checks.** Configure the platform's liveness check to call `GET /health` and its readiness/traffic check to call `GET /ready`. A `503` from `/ready` means MongoDB is unavailable; the instance should not receive application traffic until it returns `200`.
- **Logs and alerts.** Retain the backend's stdout and stderr JSON logs in the hosting platform or a log service. Alert on entries with `level: "error"`, sustained `statusCode >= 500` request events, and readiness-check failures. Use `requestId` to correlate an alert, an error event, and its completed request; do not configure a log collector to capture request bodies or headers.
- **Recovery.** Use the [backup, recovery, and encryption-key runbook](docs/backup-and-recovery.md). The MongoDB archive and the exact `NOTE_ENCRYPTION_KEY` that protects its encrypted notes are one recovery set; retain and test both together.
- **Release verification.** Configure and run the [deployment smoke check](docs/deployment-smoke-checks.md) after every release. It checks the deployed frontend, PWA assets, API, CORS, secure cookies, and database connectivity from outside the deployment.

## Notes for contributors

- The directories `server/src/modals/` and `server/src/middlewear/` are misspelled — match the existing spelling in imports.
- Note content is HTML, not plain text: never render it with `{note.content}` (use `htmlToText`), and never check emptiness with `content.trim()` (an empty document serialises to `<p></p>` — use `isEmptyHtml`).
- See [CLAUDE.md](CLAUDE.md) for the fuller architectural rationale behind these constraints.
