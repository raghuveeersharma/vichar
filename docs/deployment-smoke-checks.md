# Deployment smoke checks

The smoke check verifies the public contracts that break most often when the
frontend and API are deployed independently:

- the frontend shell and SPA deep-link fallback;
- the web manifest and service-worker script required for the PWA, plus actual
  registration, activation, and page control in Chromium;
- API liveness (`/health`) and MongoDB readiness (`/ready`);
- exact credentialed CORS for the frontend origin; and
- secure-cookie login, session rehydration, and logout.

It never creates, edits, or deletes notes. Its optional account must be a
dedicated, least-privilege smoke-test user; do not supply a personal or
administrator account.

## Run it

Use public HTTPS URLs. The API value may be its origin or the frontend-style
base URL ending in `/api`.

```bash
VICHAR_FRONTEND_URL='https://app.example.com' \
VICHAR_API_URL='https://api.example.com/api' \
VICHAR_SMOKE_EMAIL='vichar-smoke@example.com' \
VICHAR_SMOKE_PASSWORD='stored-in-a-secret-manager' \
node scripts/deployment-smoke-check.mjs
```

The check intentionally rejects HTTP URLs. For a disposable local deployment
only, add `--allow-http`. Supplying no account credentials still checks the
public endpoints, PWA assets, and CORS preflight, but skips the cookie path and
is not sufficient for a production launch check.

## GitHub Actions setup

The `Deployment smoke checks` workflow runs every day and can be started from
the Actions tab after a release. Configure these repository values before
enabling a production deployment:

| Type | Name | Value |
| --- | --- | --- |
| Variable | `VICHAR_FRONTEND_URL` | Public frontend HTTPS URL |
| Variable | `VICHAR_API_URL` | Public API HTTPS URL, optionally ending `/api` |
| Secret | `VICHAR_SMOKE_EMAIL` | Dedicated smoke-test account email |
| Secret | `VICHAR_SMOKE_PASSWORD` | Its password |

The workflow fails if any value is missing, so a skipped cookie check cannot be
mistaken for a successful production probe. Run it immediately after every
deployment as part of release approval. Configure the hosting platform's own
continuous health/readiness probes as described in the root README; those are
separate from this end-to-end check.
