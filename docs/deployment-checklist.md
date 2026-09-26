# Deployment checklist

Use this for every production environment and release.

## Before first deploy

- [ ] Provision MongoDB and create its indexes by starting the API against the
  production database. Confirm the notes owner/date and owner/folder/date
  indexes plus the case-insensitive unique folder-name index exist.
- [ ] Set `MONGODB_URI`, `JWT_SECRET`, exact `CORS_ORIGIN`, SMTP values, and
  `NODE_ENV=production` in the host secret store.
- [ ] Generate and escrow `NOTE_ENCRYPTION_KEY` if encrypted notes will be
  offered. Keep two access-controlled copies outside source control; see the
  [key policy](backup-and-recovery.md).
- [ ] Set `VITE_SERVER_URL` to the public API URL including `/api`, then build
  and deploy the frontend.
- [ ] Configure HTTPS custom domains. Set `CORS_ORIGIN` to the exact frontend
  origin, with no trailing path or wildcard.
- [ ] Ensure the frontend host rewrites SPA deep links to `index.html` while
  preserving static PWA files such as `/sw.js` and `/manifest.webmanifest`.
- [ ] Configure platform health probes: `/health` for liveness and `/ready` for
  readiness/traffic admission.
- [ ] Configure MongoDB backups, separate key escrow, log retention, and
  alerts as described in [backup-and-recovery.md](backup-and-recovery.md).

## Release and rollback

- [ ] Run backend tests, frontend lint/build, and automated accessibility checks.
- [ ] Deploy the API and frontend, then run the
  [deployment smoke check](deployment-smoke-checks.md) with a dedicated
  least-privilege account.
- [ ] Verify a secure cookie login, a PWA update, email delivery, and one
  encrypted-note read/write if encryption is enabled.
- [ ] Monitor JSON error logs and `/ready` after traffic is switched.
- [ ] If rollback is necessary, restore the previous API/frontend artifacts
  first. Do not change `NOTE_ENCRYPTION_KEY`; use the matching key for any
  database restoration and follow the recovery runbook.
