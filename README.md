# therapy_service_hours_frontend

Prepared browser sign-in and paired release instructions: [auth flow](docs/auth-flow.md).

React + TypeScript single-page app (Vite), served from S3 and CloudFront. Part of the **Therapy Service Hours Tracker** (see [CLAUDE.md](CLAUDE.md)).

## Start here

- **Specification and working agreements:** [CLAUDE.md](CLAUDE.md)
- **Engineering standards** (rules block merges): [docs/standards/](docs/standards/README.md)
- **Decisions:** [docs/adr/](docs/adr/README.md)
- **Backlog:** [docs/jira/](docs/jira/README.md)
- **Operations** (deploy, approvals, alarms, pipeline failures): [infra runbook](https://github.com/malcolmjefferson/therapy_service_hours_infra/blob/main/docs/runbook.md)

## Quick start (new developer)

**Prerequisites:** [Node](https://nodejs.org/) 22.12 or later, [gitleaks](https://github.com/gitleaks/gitleaks) (secret scanning in the pre-commit hook, SEC-61), and for live API calls a local backend (see the [backend README](https://github.com/malcolmjefferson/therapy_service_hours_backend#quick-start-new-developer)).

```bash
git clone https://github.com/malcolmjefferson/therapy_service_hours_frontend.git
cd therapy_service_hours_frontend
git config core.hooksPath .githooks   # once per clone: the pre-commit hook blocks commits with secrets (and when gitleaks is missing)
npm ci
npm run dev                            # http://localhost:5173
```

The start page shows **System status**. With the backend running locally (`APP_VERSION=local LOCAL_HTTP_ADDR=127.0.0.1:8080 go run ./cmd/api` in the backend repo) it reads **Up** and version `local`; without it, the page shows an error with a **Retry** button. `npm test` needs no backend: it mocks the API with MSW.

## Commands

Requires Node 22.12 or later.

| Command             | What it does                                                                                                        |
| ------------------- | ------------------------------------------------------------------------------------------------------------------- |
| `npm ci`            | Install exact dependencies from `package-lock.json`                                                                 |
| `npm run dev`       | Dev server on http://localhost:5173; `/api` is proxied to a local backend on `127.0.0.1:8080`                       |
| `npm run lint`      | ESLint (strict, type-checked; hooks, a11y, import boundaries FE-01/FE-02, FE-60 bans) and the FE-43 hex-color check |
| `npm run typecheck` | `tsc` with the FE-26 strict flags                                                                                   |
| `npm test`          | Vitest + React Testing Library + MSW (API mocked at the network boundary)                                           |
| `npm run build`     | Production build to `dist/`                                                                                         |
| `npm run api:types` | Regenerate `src/lib/api/schema.d.ts` from the pinned spec                                                           |
| `npm run e2e`       | Playwright smoke and header scan (below)                                                                            |

## Smoke test (Playwright, S0-20)

`e2e/smoke.spec.ts` checks a running environment: a deep link loads the SPA, `/api/v1/healthz` returns JSON, an unknown API path returns problem+json, the security headers by name and value, and no console or CSP errors.

- **Locally:** `npx playwright install chromium` once, then `npm run e2e`. It builds the app and serves it with `e2e/local-server.mjs`, a stand-in that mirrors the CloudFront headers and routing (with a fake healthz). CI runs this on every PR.
- **Against an environment:** `SMOKE_URL=https://<distribution>.cloudfront.net npm run e2e`. The pipeline does this after every dev and prod deploy; a failure stops the release.
- If you change a header in the infra web construct, change `e2e/local-server.mjs` to match.

## Log-an-entry journey (Playwright, S2-17)

`e2e/log-entry.spec.ts` drives the critical path of the entries page in a real browser: sign in, add a client, log an entry and see it in the table, get an overlapping session refused, then edit and delete the entry.

- **Where it runs:** only against the enabled dev release (`APP_ENV=dev`, `AUTH_ENABLED=true`, `SMOKE_URL`), in the pipeline smoke step. Local and PR runs skip it, as they skip the native sign-in suite.
- **Sign-in:** the native-client route of ADR-0011 through `e2e/native-browser.ts` (see `docs/auth-flow.md`). The Gateway, Lambdas and database are real; nothing drives Google.
- **Data:** every name is a fictional pseudonym starting `E2E Pseudonym`. The test removes its entries and client before and after the run, even when a step fails.

## API contract

`src/lib/api/openapi.yaml` is a **pinned copy** of the backend spec; `openapi.source.json` records the backend commit it came from (ADR-0006). Types are generated from it with openapi-typescript, and `openapi-fetch` is the typed client, so removing an endpoint from the spec breaks the build wherever it is called.

| Command                                           | What it does                                                                                                      |
| ------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------- |
| `npm run api:sync [-- --from <backend checkout>]` | Copy the backend spec (default `../therapy_service_hours_backend`), record its HEAD commit, regenerate the types  |
| `npm run api:types:check`                         | Fail if `schema.d.ts` is stale (runs in CI)                                                                       |
| `npm run api:drift -- --backend-spec <path>`      | **Drift gate**: fail if the pinned copy differs from the backend spec being released (run by the pipeline, S0-14) |

## Layout

```
src/app/          Shell, routes (lazy), providers, error boundary
src/features/     One folder per feature; import a feature only through its index.ts (FE-01)
src/components/   Shared UI (never imports features or app, FE-02)
src/lib/api/      Pinned spec, generated types, typed client and its context
src/theme/        Design tokens (the only place colors are written), global styles, self-hosted fonts
src/test/         MSW server, typed handlers, render helpers
```

## Contributing

- `main` is protected: changes go through a pull request with passing checks (ARC-49).
- Work on a branch named after the ticket, for example `feat/S0-03-backend-skeleton`.
- Fill in the PR template, including the standards checklists.
- Client data is **pseudonyms or initials only**, everywhere (CLAUDE.md §0.7).
