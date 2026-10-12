# Prepared browser sign-in (S1-10/S1-11/S1-16)

Release the paired infra preparation first, then this frontend. Infra adds the exact Cognito
origin to CSP and writes a validated public `auth-config.json` at deployment. It is no-store and
invalidated with index.html. The default local/build file is `{"enabled":false}`; preparation
keeps dev and prod auth disabled and the existing status page visible.

Enabled config contains only the SPA client ID, issuer, hosted origin, callback and logout URLs.
The browser rejects foreign callbacks, unexpected fields and secret fields. Native-test client
credentials are never included. A failed config load shows a generic error rather than opening
protected routes. No dependencies are added.

The enabled landing starts authorization code + PKCE S256 with Google. A cryptographically random
state, nonce and verifier survive the redirect in session storage for at most ten minutes. They
are consumed once, including on failure; tokens never enter local or session storage. Callback
processing strips query values before exchanging the code. Duplicate/missing state or code,
expired transactions and provider errors fail closed without displaying error_description.

The token response travels directly over HTTPS from the configured Cognito endpoint. Issuer,
audience, token type, expiry and the first exchange's nonce are checked. Browser claims grant no
roles: all displayed identity and roles come from `/me`, and Gateway/backend enforce access.
ID/refresh tokens remain in the session instance. Refresh is single-flight; a late refresh after
invalidation/logout cannot restore tokens. A reload creates a new session with no tokens and
redirects through the classic hosted-UI cookie, omitting the forced Google provider. It does not
send `prompt=none`, which is [managed-login-only](https://docs.aws.amazon.com/cognito/latest/developerguide/authorization-endpoint.html).

401, including Gateway's ordinary JSON body, clears the session/private query cache and returns
to sign-in. `/me` 403 clears tokens and shows "Access has not been granted". Roles in token claims
cannot create menu permissions. The account disclosure menu remains available during a profile
outage so the user can sign out. Role-specific feature navigation arrives with those features;
this preparation implements the account, landing, profile and denied views only.

Sign-out clears tokens/cache before requesting refresh revocation, then visits hosted logout
even if revocation fails. The failed revocation rejects rather than reporting success; local
tokens remain cleared. OAuth POSTs reject redirects to avoid forwarding credentials elsewhere.
Neither raw upstream errors nor callback/token material is logged.

Validation: typecheck, lint, format, 47 frontend tests and eight local Chromium tests pass.
Browser OAuth is intercepted using fictional tokens: it checks S256, sign-in, reload, sign-out,
callback denial, forbidden profiles, no persistent tokens and no role grant from token groups.
Accessibility tests have no serious/critical violations. Those tests do not claim actual Google
federation or replace S1-13's live native-client acceptance. Pool activation and the owner's real
Google sign-in/sign-out demonstration follow both reviewed preparation releases.

## Dev native-token browser acceptance (S1-13)

The dev release already passes the fixed native-client inputs to the Playwright step:
`APP_ENV`, `AUTH_ENABLED`, `SMOKE_URL`, `USER_POOL_ID`, `TEST_CLIENT_ID`,
`TEST_CREDENTIALS_ARN` and the scoped `SMOKE_READER_ROLE_ARN`. The new native suite
runs only for enabled dev. Ordinary local/PR runs skip it without reading AWS credentials;
production runs never use this client. No application bundle or auth backdoor is added.

The Node runner verifies the dev test client's identity, obtains the managed password through
the existing read-only role, and authenticates the two fixed synthetic users. AWS CLI inputs
stay in private temporary files, outputs are captured, raw errors are redacted, and temporary
files are removed. Tokens remain in runner memory; trace, screenshot and video recording are
disabled for these tests. A refresh token is revoked in cleanup even after browser failure.

Google authorize/token redirects are intercepted with a fictional state/nonce protocol token.
Native password tokens cannot satisfy the SPA's first-exchange OAuth nonce or SPA audience.
Only the exact same-origin `/api/v1/me` request is relayed using the real native ID token,
without redirect forwarding. Gateway and the backend validate that real token and return the
real profile/problem response; neither admission nor roles are mocked. The deployed browser
must render Test Invited for 200, show access denied for 403, grant no fictional token-group
admin role, clear storage and complete sign-out. Native revocation is real; hosted logout is
intercepted. This combines native admission with deployed UI behavior and does not claim
actual Google federation, real hosted-cookie logout or native-token support in the shipped SPA.

S1-13 remains in progress until the native suite runs against enabled dev in the release smoke
stage and the approved manual Google first/repeat sign-in and logout demo is recorded. The
first activation attempt failed at the PostgreSQL image pull limit; backend #27's
registry fix is merged and the replacement release is in progress. Synthetic
protocol/local tests alone do not satisfy that live acceptance.
