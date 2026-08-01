# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Overview

Vichar is a multi-tenant notes app split into two independently-deployed packages in one repo. Tenancy is per-user: every note carries an `owner`, and a user can only ever see or modify their own.

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

- `server/.env` — `PORT`, `MONGODB_URI`, `CORS_ORIGIN`, `JWT_SECRET`, `NODE_ENV`. `CORS_ORIGIN` must be the frontend's **exact** origin, not a wildcard: `cors` runs with `credentials: true`, and browsers reject `*` on credentialed requests, which silently breaks auth. Missing `JWT_SECRET` exits the process at boot rather than failing per request. `NODE_ENV=production` switches the auth cookie to `Secure` + `SameSite=None`, which is required when the SPA and API are on different domains.
- `front/.env` — `VITE_SERVER_URL`, which must include the `/api` suffix (e.g. `http://localhost:5000/api`) because [axios.js](front/src/libs/axios.js) sets it as `baseURL` and callers request paths like `/notes`. Note the example file lives at `front/src/.env.example` but Vite loads `.env` from `front/`.

## Folder structure

### `server/` — Express API

```
server/
├── .env / .env.example
└── src/
    ├── index.js                      # entry: JWT_SECRET guard → cors(credentials) → rateLimiter → json → cookieParser → mount routers → db().then(listen)
    ├── config/db.js                  # mongoose.connect(MONGODB_URI); process.exit(1) on failure
    ├── libs/token.js                 # sign/verify JWT + set/clear the httpOnly cookie (single source of cookie flags)
    ├── routes/
    │   ├── authRoutes.js             # POST /signup · /login · /logout · GET /me · PATCH /email · /password (last three guarded)
    │   └── notesRoutes.js            # GET / · POST / · PUT /:id · GET /:id · DELETE /:id
    ├── controllers/
    │   ├── authControllers.js        # signup, login, logout, me, updateEmail, updatePassword
    │   └── notesControllers.js       # getAllNotes, createNote, getNoteById, updateNoteById, deleteNoteById
    ├── modals/                       # "models", misspelled
    │   ├── user.modal.js             # name/email/password; pre-save bcrypt hash; comparePassword; toPublicJSON
    │   └── note.modal.js             # title/content/owner + compound {owner, createdAt} index
    └── middlewear/                   # "middleware", misspelled
        ├── rateLimiter.js            # 50 req / 15 min per IP, applied app-wide
        └── protect.js                # verifies the cookie JWT, attaches req.user
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
    ├── main.jsx                      # StrictMode > BrowserRouter > AuthProvider > App, + <Toaster />
    ├── App.jsx                       # <Navbar /> + Routes split into GuestRoute / ProtectedRoute groups
    ├── index.css                     # tailwind directives
    ├── context/
    │   ├── auth-context.js           # AuthContext + useAuth hook (separate file to satisfy the fast-refresh lint rule)
    │   └── AuthContext.jsx           # AuthProvider: session state, signup/login/logout, global 401 interceptor
    ├── pages/
    │   ├── Home.jsx                  # GET /notes → NoteCard grid | NotesNotFound | RateLimitUI
    │   ├── CreatePage.jsx            # POST /notes → navigate("/")
    │   ├── NoteDetailPage.jsx        # GET/PUT/DELETE /notes/:id
    │   ├── LoginPage.jsx             # returns the user to the route ProtectedRoute bounced them from
    │   ├── SignupPage.jsx            # name/email/password
    │   └── SettingsPage.jsx          # PATCH /auth/email · /auth/password (both re-verify the current password)
    ├── components/
    │   ├── Navbar.jsx                # brand; user name + new note + logout, or log in / sign up
    │   ├── ProtectedRoute.jsx        # <Outlet> guard → /login when signed out
    │   ├── GuestRoute.jsx            # inverse guard → / when already signed in
    │   ├── NoteCard.jsx              # card link to /note/:id; owns its own DELETE + optimistic setNotes
    │   ├── NotesNotFound.jsx         # empty state → /create
    │   └── RateLimitUI.jsx           # 429 banner
    └── libs/
        ├── axios.js                  # shared `api` instance (baseURL = VITE_SERVER_URL, withCredentials)
        └── utils.js                  # formatDate
```

Routes are declared in `App.jsx` as two guarded groups: `/login` and `/signup` behind `GuestRoute`, and `/`, `/create`, `/note/:id`, `/settings` behind `ProtectedRoute`. There is no data-fetching library — each page owns `useState` for `data`/`loading` and calls the shared `api` instance directly inside `useEffect` or a submit handler. `AuthContext` is the only global state. `NoteCard` receives `setNotes` from `Home` so it can splice a deleted note out of the parent list; that prop-drilled setter is the only cross-component state channel.

## Architecture notes

**API surface.** `/api/auth` (public, except `GET /me`) and `/api/notes` (fully guarded). The guard is mounted at the router level in [index.js](server/src/index.js) — `app.use("/api/notes", protect, router)` — so every note route is protected by construction and a newly added route cannot forget it.

**Tenant isolation lives in the query, not in a check.** Every handler in [notesControllers.js](server/src/controllers/notesControllers.js) filters on `owner: req.user._id` — `findOne({ _id: id, owner })`, `findOneAndUpdate`, `findOneAndDelete` — rather than fetching by id and then comparing ownership. Keep that shape: a bare `findById`/`findByIdAndUpdate` in this file is a cross-tenant data leak. Another user's note returns **404, not 403**, so responses never confirm that an id exists.

**Auth flow.** Passwords are hashed by a `pre("save")` hook on the user schema, so assigning `user.password = plaintext` and saving is always correct — never hash at the call site or you will double-hash. `password` is `select: false`, so `login` must ask for it explicitly with `.select("+password")`. Responses go through `toPublicJSON()`, which is the only thing that should ever be sent to the client. Login answers with one message for both unknown email and wrong password, to avoid disclosing which emails are registered.

**The JWT is an httpOnly cookie, never touched by JS.** [libs/token.js](server/src/libs/token.js) owns signing, verification, and all cookie flags — change cookie behaviour there, not in controllers. Consequences to keep in mind: the server needs `cookieParser` before `protect`, `cors` needs `credentials: true` with an exact origin, and the axios instance needs `withCredentials: true`. Because the token is unreadable from the frontend, the SPA learns its session by calling `GET /auth/me` on boot — there is no client-side token decoding.

**Rate limiting is global and drives UI state.** `express-rate-limit` is applied app-wide in [index.js](server/src/index.js) (50 requests / 15 min per IP). It sits *before* the auth routes, so login and signup attempts consume the same budget as note requests. `Home` treats HTTP 429 as a first-class state — it flips `isRateLimit` and renders [RateLimitUI.jsx](front/src/components/RateLimitUI.jsx) in place of the note grid; everywhere else a 429 surfaces as a toast. Preserve that 429 branch when touching data-fetching code.

**Session handling on the client is centralised in two places.** `AuthProvider` exposes `checking`, which is true until the boot `GET /auth/me` settles; both route guards must render a spinner while it is true, or a signed-in user gets bounced to `/login` on every refresh. It also installs an axios response interceptor that clears the user on any non-`/auth/` 401, which is what makes an expired cookie redirect to login on its own — so pages should stay silent on 401 rather than showing a "failed to fetch" toast.

**`getAllNotes` returns `200 []` for a user with no notes** (it used to 404 on an empty collection). `Home` distinguishes empty from loading via its `loading` flag, which starts `true` so the empty state does not flash on first paint.

**Frontend conventions.** Routing via `react-router` v7 (`Routes` in [App.jsx](front/src/App.jsx), `BrowserRouter` in [main.jsx](front/src/main.jsx)); `vercel.json` rewrites all paths to `/` for SPA deep links. Toasts via `react-hot-toast` (single `<Toaster />` at the root). Icons from `lucide-react`. Styling is Tailwind + daisyUI locked to the `forest` theme — use daisyUI semantic classes (`text-primary`, `base-content`, `bg-primary/10`) rather than raw colors.

Note the misspelled directories `server/src/modals/` (models) and `server/src/middlewear/` (middleware) — match the existing spelling in imports.

**Notes created before auth existed have no `owner`** and are therefore invisible to every user; `owner` is `required`, so they also cannot be saved through the API again. Delete them directly in Mongo if they get in the way.
