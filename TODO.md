# Vichar — Remaining work

This list reflects the current implementation and project documentation review.

## Priority 1 — security and reliability

- [x] Add CSRF protection for all state-changing API routes. Production cookies use `SameSite=None` for cross-origin frontend/API deployment, so use a CSRF token or strict Origin validation.
- [x] Add automated tests. The backend now has API integration coverage for CSRF, cookie auth, rich-text sanitisation, and tenant isolation; expand it as features are added.
- [x] Add CI (for example, GitHub Actions) to install dependencies, lint, build, and run tests on every pull request and push.
- [x] Add server-side request validation and sensible limits for email, name, note title, note HTML content, and folder name.
- [x] Define and enforce an HTML sanitisation policy for user-authored and AI-produced rich-text content.
- [x] Add stricter authentication-abuse protection, especially for login attempts (IP and/or account-based throttling).

## Priority 2 — production operations

- [x] Add liveness (`GET /health`) and MongoDB readiness (`GET /ready`) endpoints for deployment platforms and uptime monitoring.
- [x] Add structured JSON request/error logging with request IDs and deployment-ready alerting guidance.
- [x] Document MongoDB backup and restore procedures, including executable backup/restore-drill tools with CI syntax validation.
- [ ] Run and record the initial production-equivalent restore drill before launch.
- [x] Document the encryption-key backup, recovery, and rotation policy. The key must be retained; losing it makes encrypted notes unreadable.
- [x] Add deployment smoke checks for the frontend, API, CORS, secure cookies, database connectivity, and PWA registration.
- [x] Fail at boot when `CORS_ORIGIN` is unset, matching the documented requirement.

## Priority 3 — authentication and account capabilities

- [x] Add email verification.
- [x] Add a password-reset flow.
- [x] Add account deletion, including a clear policy for deleting notes, folders, cached data, and encrypted data.
- [x] Avoid revealing whether signup email addresses are already registered; signup has a uniform accepted response and creates no session.

## Priority 4 — frontend quality and performance

- [x] Add route-level code splitting / lazy loading. Route pages and editor code now load on demand.
- [ ] Add automated accessibility checks and manually test keyboard, screen-reader, contrast, dialog, and editor behaviour. Automated axe checks now cover the public account routes; manual device and assistive-technology testing remains before launch.
- [ ] Add browser/device testing for offline mode, PWA installation, service-worker updates, and speech recognition.
- [x] Make offline limitations visible to users: encrypted notes cannot be edited offline; AI editing and dictation need a connection.

## Documentation cleanup

- [x] Replace `front/README.md` with frontend-specific Vichar setup, commands, environment variables, and architecture notes.
- [x] Move `front/src/.env.example` to the conventional `front/.env.example` location, then update setup instructions accordingly.
- [x] Add an API reference with request and response examples.
- [x] Add a deployment checklist covering environment values, MongoDB indexes/setup, custom domains, CORS, cookies, encryption-key backup, verification, and rollback.
- [x] Add a limitations section to the README covering offline encrypted-note behaviour, network requirements for AI/dictation, browser support for dictation, and irreversible encryption-key loss.

## Product backlog (optional)

- [ ] Consider note search, filtering, pagination, and sorting as note collections grow.
- [ ] Consider export/import and a user-data portability policy.
- [ ] Consider audit/history or note versioning, especially for AI-assisted edits.
