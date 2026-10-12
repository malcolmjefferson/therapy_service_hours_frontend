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
