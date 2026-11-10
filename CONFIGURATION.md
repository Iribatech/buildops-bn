# Configuration Reference

The API reads configuration from the process environment. `@nestjs/config` loads
`.env` for local runs; Docker Compose loads it through `env_file`; production
loads `/var/www/buildops/.env` on the server. `.env` is never committed.

Start from `.env.example`:

```bash
cp .env.example .env
```

Generate the auth secret with:

```bash
openssl rand -hex 32
```

## 1. Runtime

| Variable | Default | Required | Purpose |
| --- | --- | --- | --- |
| `NODE_ENV` | `development` | Production: `production` | Enables production-only guards: required secrets and origins, secure cookies, no token echo in responses, no stub-only assumptions. |
| `PORT` | `3000` | No | HTTP port inside the container or process. Production compose sets it to `3000`. |
| `ALLOWED_ORIGINS` | unset (allow all) | **Yes in production** | Comma-separated browser origins allowed to make credentialed CORS calls. `*` is rejected in production. Unset outside production means any origin. |

In production, a missing `ALLOWED_ORIGINS` is a boot error. This is deliberate:
the refresh token is a cookie, so reflecting every origin with credentials would
let any website make authenticated calls.

## 2. Database

| Variable | Default | Required | Purpose |
| --- | --- | --- | --- |
| `DB_HOST` | `localhost` | Yes | PostgreSQL host. Production compose overrides it to `postgres`. |
| `DB_PORT` | `5432` | No | PostgreSQL port. Production compose overrides it to `5432`. |
| `DB_USERNAME` | `postgres` | Yes | Database user. |
| `DB_PASSWORD` | `postgres` | Yes | Database password. |
| `DB_DATABASE` | `ops` | Yes | Database name. |

Production compose requires `DB_USERNAME`, `DB_PASSWORD` and `DB_DATABASE` to be
present in `/var/www/buildops/.env` before it will start. The deploy workflow
checks for them by name and never prints their values.

`.env.example` is written for a PostgreSQL exposed on `localhost:5432`. When
using the full local compose stack, the API container receives `DB_HOST=postgres`
and `DB_PORT=5432` from `docker-compose.yml`, so the same `.env` still works.

## 3. Authentication and sessions

| Variable | Default | Required | Purpose |
| --- | --- | --- | --- |
| `JWT_SECRET` | development fallback | **Yes in production** | Signs access tokens, refresh tokens, verification links, reset links and invitations. A production boot fails if it is empty. |
| `JWT_EXPIRATION` | `3600` | No | Access-token lifetime in seconds. |
| `REFRESH_TOKEN_TTL_DAYS` | `30` | No | Absolute refresh-session lifetime. It is not extended by refreshing. |
| `SESSION_CLEANUP_INTERVAL_HOURS` | `6` | No | How often expired and revoked refresh tokens are deleted. `0` or an invalid value falls back to 6. |

`JWT_SECRET` is not scoped to one credential type. Rotating it invalidates every
access token, refresh session, verification link, reset link and invitation at
once. Plan a rotation accordingly.

Cookies are `SameSite=strict` and scoped to `/api/v1/auth`. The `secure` flag is
on whenever `NODE_ENV=production`. The CSRF cookie is readable by JavaScript by
design; the refresh cookie is httpOnly.

## 4. Rate limiting

| Variable | Default | Required | Purpose |
| --- | --- | --- | --- |
| `THROTTLE_ENABLED` | off | Production: yes | Turns the global limiter on. It is off by default so local development and tests are not throttled as one shared IP. |
| `THROTTLE_TTL` | `60000` | No | Window for the default bucket, in milliseconds. |
| `THROTTLE_LIMIT` | `300` | No | Requests per window for the default bucket. |
| `AUTH_THROTTLE_TTL` | `900000` | No | Window for the stricter credential bucket, in milliseconds. |
| `AUTH_THROTTLE_LIMIT` | `10` | No | Credential requests per window. |

Enable throttling on every public deployment:

```dotenv
THROTTLE_ENABLED=true
```

The limiter is what stands between a deployed instance and credential stuffing
on `/auth/login` or mail flooding through `/auth/forgot-password`.

## 5. Billing

| Variable | Default | Required | Purpose |
| --- | --- | --- | --- |
| `BILLING_PROVIDER` | `stub` | No | `stub` settles every plan instantly with no charge. `stripe` uses Stripe Checkout and requires the two keys below. Any other value is a boot error. |
| `STRIPE_SECRET_KEY` | unset | When provider is `stripe` | Stripe API secret. |
| `STRIPE_WEBHOOK_SECRET` | unset | When provider is `stripe` | Signing secret for `POST /api/v1/billing/webhook`. Without it, payments could be taken but never applied. |
| `STRIPE_CURRENCY` | `usd` | No | Currency used when a Stripe price is provisioned for a plan (lower-case ISO 4217). |
| `TRIAL_DAYS` | `14` | No | Trial length for a first subscription. Changing it does not alter trials already running. |

Current repository behaviour:

- An unset `BILLING_PROVIDER` selects `stub`, including in production.
- Production with `stub` logs a warning at boot because every paid plan is
  granted for free.
- `stripe` must be named explicitly and must have both keys, or the process
  refuses to start.

To take real payments:

```dotenv
BILLING_PROVIDER=stripe
STRIPE_SECRET_KEY=sk_live_...
STRIPE_WEBHOOK_SECRET=whsec_...
```

Create the Stripe webhook endpoint at:

```
https://<your-api-host>/api/v1/billing/webhook
```

and subscribe at least to `checkout.session.completed` and
`checkout.session.async_payment_succeeded`.

## 6. Email and links

| Variable | Default | Required | Purpose |
| --- | --- | --- | --- |
| `APP_BASE_URL` | unset | No | Public frontend origin used to build verification, reset and invitation links. Point it at the frontend, not the raw API, so links open a real page. |
| `EMAIL_FROM` | `no-reply@localhost` | No | Sender address. It must be accepted by the SMTP server. |
| `SMTP_HOST` | `smtp.gmail.com` | No | SMTP host. |
| `SMTP_PORT` | `465` | No | SMTP port. An empty or invalid value falls back to `465`. |
| `SMTP_SECURE` | `true` | No | `true` for implicit TLS (usually port 465), `false` for STARTTLS (usually port 587). |
| `SMTP_USER` | unset | No | SMTP username. Omit both user and password for anonymous relays. |
| `SMTP_PASSWORD` | unset | No | SMTP password. |

A failed email is logged by `MailService` and does not fail the request that
triggered it. Outside production, token-bearing responses also return
`verificationToken`/`verificationLink` or `resetToken`/`resetLink` and report
`emailSent`/`emailError`, so local flows work without SMTP. Production responses
never contain a raw token.

## 7. Notification email outbox

Notification emails are queued in `notification_emails` and delivered by a
background worker. These settings control that worker:

| Variable | Default | Purpose |
| --- | --- | --- |
| `NOTIFICATION_EMAIL_INTERVAL_MS` | `15000` | Poll interval. `0` disables the worker entirely (the e2e suite does this). |
| `NOTIFICATION_EMAIL_BATCH_SIZE` | `50` | Maximum rows claimed per pass. |
| `NOTIFICATION_EMAIL_MAX_ATTEMPTS` | `5` | Attempts before a row is marked `failed`. |
| `NOTIFICATION_EMAIL_RETRY_BASE_MS` | `60000` | Base delay for exponential backoff. |
| `NOTIFICATION_EMAIL_RETRY_MAX_MS` | `3600000` | Backoff ceiling. |
| `NOTIFICATION_EMAIL_LEASE_MS` | `120000` | How long a claimed row is leased before another worker may pick it up. |

The first retry waits `base`, the Nth waits `min(base * 2^(N-1), max)`. The
lease uses `FOR UPDATE SKIP LOCKED`, so multiple workers do not send the same
row twice.

## 8. Data retention

| Variable | Default | Purpose |
| --- | --- | --- |
| `SOFT_DELETE_RETENTION_DAYS` | `30` | How long a soft-deleted row remains recoverable. `0` or less keeps deleted rows forever and disables the purge. |
| `PURGE_INTERVAL_HOURS` | `24` | How often the purge runs. Invalid or non-positive values fall back to 24. |

The purge covers time entries, subtasks, tasks, milestones, projects, clients,
badges and teams, deepest-first in bounded batches.

## 9. Deployment-only variables

These are read by scripts and compose files rather than the application:

| Variable | Used by | Purpose |
| --- | --- | --- |
| `RUN_MIGRATIONS` | `docker-entrypoint.sh` | Default `true`. Set `false` when migrations are run as a separate release step. |
| `IMAGE_TAG` | `docker-compose.prod.yml` | Image tag to run. The deploy workflow sets it to the commit short SHA. |
| `DB_PUBLISHED_PORT` | `docker-compose.yml` | Host port for local PostgreSQL. Default `5433`. |

The deploy workflow also uses repository secrets `SSH_PRIVATE_KEY`,
`SERVER_HOST` and `SERVER_USER`. They are not application environment
variables and never belong in `.env`.

## 10. Environment checklist

**Local development**

- `cp .env.example .env`
- Set `JWT_SECRET` to any development value.
- Leave `BILLING_PROVIDER` unset (stub) or set `stub`.
- Leave `ALLOWED_ORIGINS` unset unless you need to test a specific origin.
- Leave `THROTTLE_ENABLED` unset.

**Production**

- `NODE_ENV=production`
- `JWT_SECRET` set to a fresh random value
- `ALLOWED_ORIGINS` set to the exact frontend origin(s)
- `THROTTLE_ENABLED=true`
- `DB_USERNAME`, `DB_PASSWORD`, `DB_DATABASE` set
- `BILLING_PROVIDER=stripe` plus both Stripe keys, or an explicit decision to
  run `stub` with payments bypassed
- `APP_BASE_URL` pointing at the frontend
- SMTP settings if verification, reset or invitation email must actually arrive
