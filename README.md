# therapy_service_hours_frontend

React + TypeScript single-page app (Vite), served from S3 and CloudFront. Part of the **Therapy Service Hours Tracker** (see [CLAUDE.md](CLAUDE.md)).

## Start here

- **Specification and working agreements:** [CLAUDE.md](CLAUDE.md)
- **Engineering standards** (rules block merges): [docs/standards/](docs/standards/README.md)
- **Decisions:** [docs/adr/](docs/adr/README.md)
- **Backlog:** [docs/jira/](docs/jira/README.md)

## First-time setup

1. Install [gitleaks](https://github.com/gitleaks/gitleaks) (secret scanning, SEC-61).
2. Turn on the repo's git hooks once per clone:

   ```bash
   git config core.hooksPath .githooks
   ```

   The pre-commit hook scans staged changes for secrets and **blocks the commit** if gitleaks is missing.

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
