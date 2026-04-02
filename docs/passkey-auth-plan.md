# Passkey Auth Plan

This note stores a deferred implementation plan for adding passkey-based authentication to Thesis Journey Tracker. It is intentionally a planning document, not a commitment to build the feature.

## Recommendation

Passkeys are technically feasible on this stack and would improve phishing resistance, but they are not a clean drop-in replacement for the current authentication model.

The current setup is intentionally small and lightweight:

- accounts live in D1
- accounts are created by CLI, not managed in-app
- login is a server-rendered password form
- sessions are stored in a signed `HttpOnly` cookie

Because of that, passkeys fit best as an optional upgrade path alongside passwords, not as a passkey-only authentication system.

## Why It Is Not A Simple Swap

The current flow verifies a password against `app_users`, applies IP-based lockouts via `login_attempts`, and then issues a signed session cookie. Passkeys would add new concerns that the app does not currently have:

- browser-side WebAuthn calls instead of a plain HTML form POST
- credential registration and verification endpoints
- challenge generation and temporary challenge storage
- a place for users to enroll, view, and revoke passkeys
- fallback and recovery behavior when a device is lost or unavailable
- test and automation updates for login-dependent scripts

## Fit Assessment

### Good Fit

- Cloudflare Workers and D1 are viable building blocks for WebAuthn-style flows.
- The app is private and account-based, so passkeys would protect a real login boundary.
- The current signed-cookie session model can stay in place after successful passkey verification.

### Weak Fit

- The app currently avoids account-management UI.
- The login page is deliberately simple and mostly server-rendered.
- Tooling and tests assume password login.
- A passkey-only model would create avoidable recovery and support complexity for a small internal app.

## Recommended Scope

If this feature is revisited, implement it in this order:

1. Keep password login as the primary fallback.
2. Let an already authenticated user register one or more passkeys.
3. Add optional passkey sign-in to the login page.
4. Keep account creation in the CLI unless broader account management is introduced later.

Do not start with passkey-only auth unless the project also grows an explicit account recovery and credential management workflow.

## Proposed Data Model

Add a migration for passkey credentials and one-time WebAuthn challenges.

Suggested tables:

### `app_user_passkeys`

- `id INTEGER PRIMARY KEY AUTOINCREMENT`
- `user_id INTEGER NOT NULL REFERENCES app_users(id) ON DELETE CASCADE`
- `credential_id TEXT NOT NULL UNIQUE`
- `webauthn_user_id TEXT NOT NULL`
- `public_key BLOB NOT NULL`
- `counter INTEGER NOT NULL`
- `transports TEXT`
- `device_type TEXT`
- `backed_up INTEGER NOT NULL DEFAULT 0`
- `created_at TEXT NOT NULL`
- `last_used_at TEXT`

Suggested indexes:

- `INDEX idx_app_user_passkeys_user_id ON app_user_passkeys(user_id)`

### `webauthn_challenges`

- `challenge_key TEXT PRIMARY KEY`
- `user_id INTEGER REFERENCES app_users(id) ON DELETE CASCADE`
- `challenge TEXT NOT NULL`
- `purpose TEXT NOT NULL CHECK (purpose IN ('register', 'authenticate'))`
- `expires_at TEXT NOT NULL`
- `created_at TEXT NOT NULL`

Suggested indexes:

- `INDEX idx_webauthn_challenges_expires_at ON webauthn_challenges(expires_at)`

Notes:

- `transports` can be stored as JSON text to keep the schema simple.
- `challenge_key` can be a generated nonce if the flow needs to begin before a user is fully resolved.
- expired challenges should be treated as invalid and can be lazily cleaned up.

## Suggested Backend Changes

### Auth Domain

Extend `src/auth/` with passkey-oriented store and service modules. A likely split:

- `src/auth/passkeys-store.ts`
- `src/auth/passkeys.ts`
- `src/auth/webauthn-challenges.ts`

Responsibilities:

- create registration options
- verify registration responses
- create authentication options
- verify authentication responses
- persist counters and passkey metadata
- issue the same signed session cookie after successful verification

### Routing

Add routes for JSON-based WebAuthn flows:

- `POST /auth/passkeys/register/options`
- `POST /auth/passkeys/register/verify`
- `POST /auth/passkeys/login/options`
- `POST /auth/passkeys/login/verify`

Recommended behavior:

- registration endpoints require an authenticated session
- login endpoints remain available before authentication
- successful login still ends by setting the existing session cookie

### Session Model

The current session payload stores only `name` and `role`. If passkeys are added, the auth layer should treat `app_users.id` as the durable internal identity and keep `name` as display data.

## Suggested Frontend Changes

The login page would need a small dedicated script instead of relying entirely on a plain form submit.

Minimum changes:

- add a `Sign in with passkey` button
- optionally support autofill-style passkey sign-in later
- show browser compatibility or availability errors clearly
- keep the existing password form visible as the fallback path

If passkey registration is added, create a small account-security area where an authenticated user can:

- register a new passkey
- see whether passkeys already exist
- remove a lost or obsolete passkey

This should be a narrow management surface, not a full user-admin feature set.

## Testing And Tooling Impact

This feature would affect more than runtime auth code.

Likely updates:

- auth route tests
- D1-backed auth helpers in `tests/helpers/auth.ts`
- Playwright coverage for passkey registration and login
- screenshot and Lighthouse scripts that currently automate password login

Practical guidance:

- keep password login in test flows unless there is a strong reason to automate passkeys in every script
- add focused end-to-end coverage for passkey registration and passkey sign-in separately

## External Dependency Spike

Before implementation, run a compatibility spike for the chosen WebAuthn helper library against the Cloudflare Workers runtime used by this project.

The spike should answer:

- does the verification library run under Wrangler and in deployed Workers without Node-only assumptions
- what binary or base64url conversions are needed for D1 persistence
- whether any compatibility flag or bundling workaround is needed

Do not commit to the feature before that spike succeeds.

## Safer Alternative

If the primary goal is stronger access control without adding account-lifecycle complexity inside the app, evaluate Cloudflare Access or another SSO layer first.

That approach would likely provide a better security-to-complexity ratio for this project than implementing a custom passkey flow from scratch.

## Deferred Implementation Phases

### Phase 0: Feasibility Spike

- prove Worker runtime compatibility for the selected WebAuthn helper library
- sketch the D1 schema and required binary encodings
- confirm local and production origin and RP ID expectations

### Phase 1: Optional Enrollment

- add passkey tables and stores
- add an authenticated registration flow
- add a minimal in-app screen for enrolling and removing passkeys
- keep password login unchanged

### Phase 2: Optional Passkey Login

- add a passkey button on the login page
- add authentication option and verification endpoints
- preserve password login as a visible fallback

### Phase 3: Hardening

- improve challenge cleanup
- refine error handling and audit logging
- add broader browser and device testing
- document recovery expectations clearly

## Estimated Effort

Very rough estimate if revisited later:

- feasibility spike: 0.5 to 1 day
- optional enrollment plus optional login: 2 to 4 days
- additional time if the feature expands into passkey-only auth, admin management, or stronger recovery workflows

## Current Conclusion

Passkeys are worth keeping on the shelf as an optional future enhancement, but they are not the best next authentication move for the project in its current form.

If the app later grows broader account management or needs stronger login protection for a larger team, revisit this plan and start with Phase 0 rather than implementation directly.
