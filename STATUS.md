# Status: therapy_service_hours_frontend

> Ticket status for this repo. Updated in the same PR that changes a ticket's state (CLAUDE.md §0.10).
> Tickets: `docs/jira/`. Other repos: [backend](https://github.com/malcolmjefferson/therapy_service_hours_backend/blob/main/STATUS.md), [infra](https://github.com/malcolmjefferson/therapy_service_hours_infra/blob/main/STATUS.md).

## Summary (2026-10-10)

- **Slice S0 (walking skeleton):** 4 done, 1 in review, 1 in progress, 1 not started (of 7 tickets touching this repo).
- **AWS:** account bootstrapped for CDK in us-west-2 (CDKToolkit). First dev deploy of the data stack (VPC, RDS, database roles) is pending; nothing else is deployed.
- **Next:** S0-11 (API) and S0-12 (web) constructs, then the pipeline (S0-14 to S0-16) and alerts and budget (S0-18).

## Tickets

| ID    | Title                                                                          | Status      | PRs                                                                                        | Notes                                                                                      |
| ----- | ------------------------------------------------------------------------------ | ----------- | ------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------ |
| S0-01 | Create repos, branch protection and project scaffolding                        | done        | [frontend #1](https://github.com/malcolmjefferson/therapy_service_hours_frontend/pull/1)   | Branch protection turned on by the owner                                                   |
| S0-02 | Apply accepted decisions: CLAUDE.md updated for ADR-0001 to ADR-0006           | done        | [frontend #3](https://github.com/malcolmjefferson/therapy_service_hours_frontend/pull/3)   | Also records public repos and GitHub Actions PR gates                                      |
| S0-13 | Frontend skeleton: Vite + TS, router, TanStack Query, theme, self-hosted fonts | done        | [frontend #2](https://github.com/malcolmjefferson/therapy_service_hours_frontend/pull/2)   |                                                                                            |
| S0-17 | CI security and quality gates                                                  | done        | [frontend #4](https://github.com/malcolmjefferson/therapy_service_hours_frontend/pull/4)   | Dependabot ignore rules for held-back majors: frontend #10, infra #9 (in review)           |
| S0-19 | OpenAPI pinned-copy sync and drift gate in frontend and pipeline               | in progress | [frontend #5](https://github.com/malcolmjefferson/therapy_service_hours_frontend/pull/5)   | Frontend part merged; the pipeline drift step comes with S0-14                             |
| S0-20 | Minimal Playwright smoke and header scan against dev                           | in review   | [frontend #13](https://github.com/malcolmjefferson/therapy_service_hours_frontend/pull/13) | Spec and local stand-in here; the pipeline smoke step that runs it against dev is in infra |
| S0-21 | Runbook v0 and README per repo                                                 | not started | -                                                                                          |                                                                                            |

Statuses: **not started**, **in progress**, **in review** (PR open), **done** (merged to main).
