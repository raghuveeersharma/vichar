# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Overview

Vichar is a notes app split into two independently-deployed packages in one repo:

- `front/` — React 19 + Vite SPA (deployed to Vercel)
- `server/` — Express 5 + Mongoose REST API

There is no root `package.json` or workspace tooling. Install and run each package separately.

## Commands

```bash
# Backend (from server/)
npm install
npm run dev        # nodemon src/index.js
npm start          # node src/index.js

# Frontend (from front/)
npm install
npm run dev        # vite dev server
npm run build      # vite build
npm run preview    # serve the production build
npm run lint       # eslint .
```

There are no tests in either package — `server`'s `test` script is the npm default stub.

## Environment

Both packages read env from their own `.env`, which is gitignored.

- `server/.env` — `PORT`, `MONGODB_URI`, and `CORS_ORIGIN` (read in [server/src/index.js](server/src/index.js) but **not** listed in `server/.env.example`; without it `cors` falls back to reflecting no origin).
- `front/.env` — `VITE_SERVER_URL`, which must include the `/api` suffix (e.g. `http://localhost:5000/api`) because [axios.js](front/src/libs/axios.js) sets it as `baseURL` and callers request paths like `/notes`. Note the example file lives at `front/src/.env.example` but Vite loads `.env` from `front/`.

## Folder structure

### `server/` — Express API

```
server/
├── .env / .env.example
└── src/
    ├── index.js                     # entry: dotenv → cors → rateLimiter → json → mount /api/notes → db().then(listen)
    ├── config/db.js                  # mongoose.connect(MONGODB_URI); process.exit(1) on failure
    ├── routes/notesRoutes.js         # GET / · POST / · PUT /:id · GET /:id · DELETE /:id
    ├── controllers/notesControllers.js  # getAllNotes, createNote, getNoteById, updateNoteById, deleteNoteById
    ├── modals/note.modal.js          # "models", misspelled — Note schema
    └── middlewear/rateLimiter.js     # "middleware", misspelled — 50 req / 15 min per IP
```

Flat three-layer flow: route → controller → model. Every controller wraps its body in `try/catch`, logs `Error in <fnName>:`, and returns `500 { message: "Internal server error" }`; validation failures return `400`, missing documents `404`. Follow that shape when adding endpoints. Note `db()` is awaited before `app.listen`, so a bad `MONGODB_URI` means the server never binds a port.

### `front/` — React SPA

```
front/
├── .env                              # VITE_SERVER_URL (example lives at src/.env.example)
├── index.html                        # #root mount point
├── vite.config.js                    # @vitejs/plugin-react only
├── tailwind.config.js                # daisyUI, themes: ["forest"]
├── postcss.config.js · eslint.config.js
├── vercel.json                       # SPA rewrite: /(.*) → /
└── src/
    ├── main.jsx                      # StrictMode > BrowserRouter > App + <Toaster />
    ├── App.jsx                       # <Navbar /> + Routes; fixed radial-gradient backdrop
    ├── index.css                     # tailwind directives
    ├── pages/
    │   ├── Home.jsx                  # GET /notes → NoteCard grid | NotesNotFound | RateLimitUI
    │   ├── CreatePage.jsx            # POST /notes → navigate("/")
    │   └── NoteDetailPage.jsx        # GET/PUT/DELETE /notes/:id
    ├── components/
    │   ├── Navbar.jsx                # brand + "new note" link
    │   ├── NoteCard.jsx              # card link to /note/:id; owns its own DELETE + optimistic setNotes
    │   ├── NotesNotFound.jsx         # empty state → /create
    │   └── RateLimitUI.jsx           # 429 banner
    └── libs/
        ├── axios.js                  # shared `api` instance (baseURL = VITE_SERVER_URL)
        └── utils.js                  # formatDate
```

Routes are declared in `App.jsx`: `/` → Home, `/create` → CreatePage, `/note/:id` → NoteDetailPage. There is no global store or data-fetching library — each page owns `useState` for `data`/`loading` and calls the shared `api` instance directly inside `useEffect` or a submit handler. `NoteCard` receives `setNotes` from `Home` so it can splice a deleted note out of the parent list; that prop-drilled setter is the only cross-component state channel.

Both `NoteCard.jsx` and `NoteDetailPage.jsx` call an undefined `setIsRateLimit` in their 429 branches (the flag only exists in `Home`), so those paths throw a `ReferenceError` instead of showing the rate-limit UI. Fix or route around it rather than copying the pattern into new components.

## Architecture notes

**API surface.** A single resource mounted at `/api/notes` — full CRUD in [notesRoutes.js](server/src/routes/notesRoutes.js) → [notesControllers.js](server/src/controllers/notesControllers.js) → the `Note` model ([note.modal.js](server/src/modals/note.modal.js), `title` + `content` + timestamps). Controllers hold validation and error handling inline; there is no service layer.

**Rate limiting is global and drives UI state.** `express-rate-limit` is applied app-wide in [index.js](server/src/index.js) (50 requests / 15 min per IP). The frontend treats HTTP 429 as a distinct first-class state: pages catch it, flip an `isRateLimit` flag, and render [RateLimitUI.jsx](front/src/components/RateLimitUI.jsx) instead of the normal content. Preserve that 429 branch when touching data-fetching code.

**`getAllNotes` returns 404 on an empty collection**, not `200 []`. [Home.jsx](front/src/pages/Home.jsx) still renders [NotesNotFound.jsx](front/src/components/NotesNotFound.jsx) because its catch-all falls through to a toast plus empty `notes`. Changing either side without the other will break the empty state.

**Frontend conventions.** Routing via `react-router` v7 (`Routes` in [App.jsx](front/src/App.jsx), `BrowserRouter` in [main.jsx](front/src/main.jsx)); `vercel.json` rewrites all paths to `/` for SPA deep links. Toasts via `react-hot-toast` (single `<Toaster />` at the root). Icons from `lucide-react`. Styling is Tailwind + daisyUI locked to the `forest` theme — use daisyUI semantic classes (`text-primary`, `base-content`, `bg-primary/10`) rather than raw colors.

Note the misspelled directories `server/src/modals/` (models) and `server/src/middlewear/` (middleware) — match the existing spelling in imports.
