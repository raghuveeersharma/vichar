# Vichar — Remaining work

This list reflects the current implementation and project documentation review.

## Priority 1 — security and reliability

- [x] Add CSRF protection for all state-changing API routes. Production cookies use `SameSite=None` for cross-origin frontend/API deployment, so use a CSRF token or strict Origin validation.
- [x] Add automated tests. The backend now has API integration coverage for CSRF, cookie auth, rich-text sanitisation, and tenant isolation; expand it as features are added.
- [x] Add CI (for example, GitHub Actions) to install dependencies, lint, build, and run tests on every pull request and push.
- [ ] Add server-side request validation and sensible limits for email, name, note title, note HTML content, and folder name.
- [x] Define and enforce an HTML sanitisation policy for user-authored and AI-produced rich-text content.
- [ ] Add stricter authentication-abuse protection, especially for login attempts (IP and/or account-based throttling).

## Priority 2 — production operations

- [ ] Add a health/readiness endpoint for deployment platforms and uptime monitoring.
- [ ] Add structured server logging and error monitoring.
- [ ] Document and test MongoDB backup and restore procedures.
- [ ] Document the encryption-key backup, recovery, and rotation policy. The key must be retained; losing it makes encrypted notes unreadable.
- [ ] Add deployment smoke checks for the frontend, API, CORS, secure cookies, database connectivity, and PWA registration.
- [ ] Decide whether the server should fail at boot when `CORS_ORIGIN` is unset. The README marks it as required, but the server currently validates only `JWT_SECRET`.

## Priority 3 — authentication and account capabilities

- [ ] Add email verification.
- [ ] Add a password-reset flow.
- [ ] Add account deletion, including a clear policy for deleting notes, folders, cached data, and encrypted data.
- [ ] Decide whether signup should avoid revealing that an email address is already registered.

## Priority 4 — frontend quality and performance

- [ ] Add route-level code splitting / lazy loading. The current production JavaScript bundle is about 740 kB uncompressed (about 237 kB gzip).
- [ ] Add automated accessibility checks and manually test keyboard, screen-reader, contrast, dialog, and editor behaviour.
- [ ] Add browser/device testing for offline mode, PWA installation, service-worker updates, and speech recognition.
- [ ] Make offline limitations visible to users: encrypted notes cannot be edited offline; AI editing and dictation need a connection.

## Documentation cleanup

- [ ] Replace `front/README.md`, which is still the default Vite template, with frontend-specific Vichar setup, commands, environment variables, and architecture notes.
- [x] Move `front/src/.env.example` to the conventional `front/.env.example` location, then update setup instructions accordingly.
- [ ] Add an API reference with request and response examples, or publish an OpenAPI specification.
- [ ] Add a deployment checklist covering environment values, MongoDB indexes/setup, custom domains, CORS, cookies, encryption-key backup, verification, and rollback.
- [ ] Add a limitations section to the README covering offline encrypted-note behaviour, network requirements for AI/dictation, browser support for dictation, and irreversible encryption-key loss.

## Product backlog (optional)

- [ ] Consider note search, filtering, pagination, and sorting as note collections grow.
- [ ] Consider export/import and a user-data portability policy.
- [ ] Consider audit/history or note versioning, especially for AI-assisted edits.
