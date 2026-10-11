# Status: therapy_service_hours_frontend

> Ticket status for this repo. Updated in the same PR that changes a ticket's state (CLAUDE.md §0.10).
> Tickets: `docs/jira/`. Other repos: [backend](https://github.com/malcolmjefferson/therapy_service_hours_backend/blob/main/STATUS.md), [infra](https://github.com/malcolmjefferson/therapy_service_hours_infra/blob/main/STATUS.md).

## Summary (2026-10-10)

- **Slice S0 (walking skeleton):** 7 done, 0 in review, 0 in progress, 0 not started (of 7 tickets touching this repo).
- **AWS:** dev data stack deployed 2026-10-10. The SPA reaches dev (S3 and CloudFront) with the first pipeline run.
- **S1:** execution started; ADR-0008–0011 accepted by the owner on 2026-10-11.

## Tickets

| ID    | Title                                                                          | Status | PRs                                                                                                                                                                                                                                                                        | Notes                                                                                      |
| ----- | ------------------------------------------------------------------------------ | ------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------ |
| S0-01 | Create repos, branch protection and project scaffolding                        | done   | [frontend #1](https://github.com/malcolmjefferson/therapy_service_hours_frontend/pull/1)                                                                                                                                                                                   | Branch protection turned on by the owner                                                   |
| S0-02 | Apply accepted decisions: CLAUDE.md updated for ADR-0001 to ADR-0006           | done   | [frontend #3](https://github.com/malcolmjefferson/therapy_service_hours_frontend/pull/3)                                                                                                                                                                                   | Also records public repos and GitHub Actions PR gates                                      |
| S0-13 | Frontend skeleton: Vite + TS, router, TanStack Query, theme, self-hosted fonts | done   | [frontend #2](https://github.com/malcolmjefferson/therapy_service_hours_frontend/pull/2)                                                                                                                                                                                   |                                                                                            |
| S0-17 | CI security and quality gates                                                  | done   | [frontend #4](https://github.com/malcolmjefferson/therapy_service_hours_frontend/pull/4), frontend PR (this one)                                                                                                                                                           | npm audit runs on PRs and weekly (audit workflow), no longer as a pipeline release gate    |
| S0-19 | OpenAPI pinned-copy sync and drift gate in frontend and pipeline               | done   | [frontend #5](https://github.com/malcolmjefferson/therapy_service_hours_frontend/pull/5)                                                                                                                                                                                   | Frontend part and the pipeline drift step (infra #16) merged                               |
| S0-20 | Minimal Playwright smoke and header scan against dev                           | done   | [frontend #13](https://github.com/malcolmjefferson/therapy_service_hours_frontend/pull/13)                                                                                                                                                                                 | Spec and local stand-in here; the pipeline smoke step that runs it against dev is in infra |
| S0-21 | Runbook v0 and README per repo                                                 | done   | [frontend #14](https://github.com/malcolmjefferson/therapy_service_hours_frontend/pull/14), [infra #20](https://github.com/malcolmjefferson/therapy_service_hours_infra/pull/20), [backend #12](https://github.com/malcolmjefferson/therapy_service_hours_backend/pull/12) | New-developer quick start and the smoke test; runbook lives in infra                       |

Statuses: **not started**, **in progress**, **in review** (PR open), **done** (merged to main).

## S1 execution (2026-10-11)

| ID    | Title                 | Status    | PRs                                                                               | Notes                                                                                                                                      |
| ----- | --------------------- | --------- | --------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------ |
| S1-02 | Auth design decisions | in review | [#18](https://github.com/malcolmjefferson/therapy_service_hours_frontend/pull/18) | Owner accepted ADR-0008–0011 as proposed on 2026-10-11; decision docs prepared for review. Live federation and latency proof remain S1-18. |
