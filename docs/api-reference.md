# API reference

All application routes are under `/api`. Authentication uses the `token`
httpOnly cookie; browser clients must send credentials and every state-changing
request must have an `Origin` exactly equal to `CORS_ORIGIN`.

Errors use `{ "message": "…" }`. Invalid input returns `400`, an absent or
other user's resource returns `404`, and an unexpected failure returns `500`.
Every response includes `X-Request-Id` for support correlation.

## Authentication

### Sign up

`POST /auth/signup`

```json
{ "name": "Ada", "email": "ada@example.com", "password": "six or more characters" }
```

Always returns `202` with the same response whether the email is new or is
already registered. It does not establish a session.

```json
{ "message": "If this email address can be registered, check your inbox for verification instructions." }
```

### Log in and session

`POST /auth/login`

```json
{ "email": "ada@example.com", "password": "six or more characters" }
```

Returns `200`, sets the cookie, and returns the public account object:

```json
{ "user": { "_id": "…", "name": "Ada", "email": "ada@example.com", "emailVerified": true, "encryptedNotesEnabled": false } }
```

`GET /auth/me` returns the same `user` object. `POST /auth/logout` clears the
cookie and returns `200`.

### Verification and password reset

- `POST /verify-email` takes `{ "token": "signed-link-token" }` and consumes
  a one-use link.
- `POST /email-verification/resend` requires a session and returns `204`.
- `POST /password-reset/request` takes `{ "email": "ada@example.com" }` and
  always returns `204`; if appropriate it sends a one-use, one-hour link.
- `POST /password-reset/confirm` takes `{ "token": "…", "newPassword": "…" }`.
  It returns `204`, consumes the link, and expires all existing sessions.

### Account changes

- `PATCH /email` takes `{ "email": "new@example.com", "currentPassword": "…" }`.
- `PATCH /password` takes `{ "currentPassword": "…", "newPassword": "…" }`.
- `PATCH /preferences` takes `{ "encryptedNotesEnabled": true }`.
- `DELETE /account` takes `{ "currentPassword": "…" }`. It returns `204` and
  permanently deletes the user, all owned notes/folders, encrypted records, and
  local offline cache on the client.

## Notes and folders

All note and folder routes require a session. For example, create a note with
`POST /notes`:

```json
{ "title": "Ideas", "content": "<p>First idea</p>", "folder": null, "encrypted": false }
```

It returns `201` with `{ "note": { … } }`. `GET /notes` lists all notes;
`GET /notes?folder=unfiled` lists notes without folders; `GET`, `PUT`, and
`DELETE /notes/:id` operate on one note. A `PUT` accepts the same editable
fields as create. `encrypted: true` is permitted only when the user has enabled
encrypted notes in preferences.

Folders use `GET`/`POST /folders` and `GET`/`PATCH`/`DELETE /folders/:id`.
Create and rename accept `{ "name": "Work" }`. Deleting a nonempty folder
returns `409`; move or delete its notes first.

## AI and probes

`POST /ai/grammar` and `POST /ai/format` require a session and accept the note
HTML body. Both return sanitised supported HTML. They are rate-limited and
return `503` when Gemini is not configured.

`GET /health` returns `{ "status": "ok" }`; `GET /ready` returns
`{ "status": "ready" }` only while MongoDB is connected. These are outside
`/api` and require neither a cookie nor `Origin`.
