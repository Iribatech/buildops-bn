# BuildOps Architecture Overview

This document describes how the BuildOps API is put together today. It is a
map of the running system, not a product specification. Domain rules and field
definitions live in `docs/specification.md`; the caller-facing contract lives in
`docs/frontend-guide.md` and `docs/openapi.json`.

The design is a **modular monolith**: one NestJS process owns every HTTP route
and both realtime namespaces, one PostgreSQL database holds all tenant data,
and files live on a local volume. That keeps transactions, permissions and
deployments simple while the product is still one application. Module boundaries
are explicit so a piece can be extracted later without rewriting its domain
logic.

## 1. Runtime topology

```
Browser / mobile / scripts
        |
        | HTTP  /api/v1/*
        | WS    /realtime, /chat
        v
   +-----------------+        +------------------+
   | nginx (prod)    |        | SMTP relay       |
   | TLS + vhost     |        | (nodemailer)     |
   +--------+--------+        +---------^--------+
            |                           |
            v                           |
   +-----------------+                  |
   | API container   |------------------+
   | Node 22 + Nest  |        +------------------+
   | port 3000       |------->| Stripe (optional)|
   +--------+--------+        +------------------+
            |
            | SQL
            v
   +-----------------+        +------------------+
   | PostgreSQL 16   |        | uploads volume   |
   | (private)       |        | /app/uploads     |
   +-----------------+        +------------------+
```

In production the API is published on `127.0.0.1:3100` only. nginx terminates TLS
for the public host and proxies to that loopback port. PostgreSQL has no
published port; the API reaches it over the compose network. Uploaded files are
stored under `/app/uploads` on a named volume so they survive container
replacement. See `docker-compose.prod.yml` and `DEPLOYMENT.md`.

Locally, `docker-compose.yml` runs the API and PostgreSQL together. Outside
Docker, `docker-compose.dev.yml` runs only PostgreSQL on `localhost:5432` and the
API is started with `pnpm run start:dev`.

## 2. Process and module layout

Everything starts from `src/main.ts`:

1. `NestFactory.create(AppModule, { rawBody: true })` keeps the raw bytes needed
   to verify Stripe webhook signatures.
2. `configureApp()` in `src/bootstrap.ts` applies the global prefix `api/v1`,
   Helmet, cookie parsing, CORS, the global validation pipe, the Socket.IO
   adapter and shutdown hooks.
3. `setupSwagger()` in `src/swagger.setup.ts` publishes
   `/api/v1/docs` and `/api/v1/docs-json`.

`src/app.module.ts` imports feature modules and registers three process-wide
concerns:

| Concern | Implementation | Why global |
| --- | --- | --- |
| Configuration | `ConfigModule.forRoot({ isGlobal: true })` | Every module reads the same environment. |
| Database | `TypeOrmModule.forRootAsync` with `migrationsRun: true`, `synchronize: false` | The schema is migration-owned; boot applies pending migrations. |
| Rate limiting | `ThrottlerGuard` via `APP_GUARD`, buckets from `ThrottlerModule` | Every route must share the same limiter, including public ones. |
| Activity actor | `ActivityContextInterceptor` via `APP_INTERCEPTOR` | Mutations anywhere must attribute the caller without threading ids through services. |
| Soft-delete retention | `SoftDeletePurgeService` | The sweep spans many tables, so it belongs to no single feature module. |

Feature modules follow the same shape: `*.module.ts` declares the boundary,
`*.controller.ts` owns HTTP concerns and decorators, `*.service.ts` holds domain
logic and transactions, `*.entity.ts` maps persistence, and `dto/` holds the
validated request and response shapes.

### Module map

**Identity and tenancy**

- `auth` — registration, login, refresh rotation, sessions, signed tokens.
- `user` — user records and profile data.
- `organization` — offices/companies that hold tenant data.
- `role` — role definitions, permission grants and membership resolution.
- `invitation` — email invitations and acceptance.
- `subscription`, `plan`, `plan-limit`, `billing` — plans, trial state, capacity
  enforcement and the payment-provider seam.
- `settings` — user preferences, organization settings and account operations.

**Work management**

- `client` — clients owned by an organization.
- `project` — projects/jobs, including project human-resource allocations.
- `task`, `subtask`, `milestone` — delivery work breakdown.
- `time-entry`, `time-complexity` — time logging and estimation.
- `badge` — labels used on work items.

**People and HR**

- `employee`, `department`, `team`, `human-resource`.
- `leave` — leave types, requests and balances.
- `performance-review` — review drafts, submission and acknowledgement.

**Collaboration**

- `comment` — comments and mentions on tasks/subtasks.
- `attachment` — authenticated file upload/download.
- `chat` — channels, direct conversations, messages, read markers.
- `notification` — in-app notifications and the email outbox.
- `activity` — the organization audit/activity trail.
- `realtime` — general Socket.IO gateway for task/subtask/project rooms.

**Read models**

- `dashboard` — aggregated delivery and time metrics.
- `workspace` — one-call bootstrap of the application shell.

## 3. Request lifecycle

An HTTP request passes through this pipeline:

1. **Global prefix** — every route lives under `/api/v1`.
2. **Helmet and cookies** — security headers, then `cookie-parser` so the
   refresh and CSRF cookies can be read.
3. **CORS** — `ALLOWED_ORIGINS` is an explicit list in production, credentials
   enabled, and `x-organization-id` plus `x-csrf-token` are allowed headers.
4. **ValidationPipe** — `whitelist`, `forbidNonWhitelisted`, implicit conversion
   disabled. DTOs are the only accepted request shape.
5. **`JwtAuthGuard`** — validates the bearer token, rejects non-access token
   purposes, checks the session family is still active, and loads a verified
   user.
6. **`PermissionsGuard`** — resolves the active organization from
   `x-organization-id` or an `:organizationId` path segment, verifies membership
   through `MembershipResolver`, and enforces the route's declared permissions.
7. **`ActivityContextInterceptor`** — publishes the actor and organization into
   async-local storage for the rest of the request.
8. **Controller → service → repository** — business rules and transactions stay
   in services; controllers do not query the database directly.
9. **Response** — collections use the shared pagination envelope
   `{ items, total, page, limit, totalPages }`; errors always carry
   `statusCode` and `message`.

Route protection is declarative:

- `@Protected()` applies JWT + organization + permission guards.
- `@SkipOrganization()` keeps JWT but drops the organization requirement.
- `@BearerProfile()` keeps JWT for user-level routes.
- `@RequirePermissions(...)` declares the permission list enforced by the guard
  and published into OpenAPI as `x-permissions`.

The same declaration therefore drives runtime authorization and generated API
documentation.

## 4. Authentication and sessions

Access tokens are short-lived, stateless bearer JWTs. They carry `sub`, `email`,
`sid` (the session family) and no `purpose` claim. `JwtStrategy` rejects any
token that carries a `purpose`, which stops a refresh, reset, verification or
invitation token from being replayed as an access token.

Refresh tokens are different:

- They live in an httpOnly cookie named `rt`, scoped to `/api/v1/auth`.
- They are stored hashed, never in plaintext.
- Every refresh rotates the token within a session family.
- Reuse of a rotated token is treated as a possible theft and revokes the whole
  family.
- Expiry is absolute, not sliding.
- `sid` is checked against the session store on every access-token request, so
  logout and "log out everywhere" take effect immediately.

CSRF is a double-submit check on the cookie-authenticated routes: the `csrf`
cookie is readable by JavaScript, and its value must be echoed in the
`x-csrf-token` header. `SameSite=strict` on both cookies is the primary defence.

Every non-access credential (refresh, email verification, password reset,
invitation) is signed with the same secret but tagged with a `purpose` and a
`jti`. Signature verification is only half the check; each token also maps to a
database record that can be consumed or revoked, which is what allows
single-use enforcement and reuse detection.

WebSocket connections authenticate with the same access token and session rules.
`/realtime` verifies the token in `handleConnection`; `/chat` additionally
resolves the caller's organization membership and `chat.view` permission before
joining rooms.

## 5. Tenancy, roles and capacity

The tenancy chain is:

```
User -> Subscription -> Organization -> Membership (role) -> Permissions
```

- A user owns a subscription; a subscription permits one or more organizations
  depending on the plan.
- Every tenant-owned row carries `organization_id` and every tenant query filters
  on it.
- The active organization is never trusted from the client alone. The guard
  verifies that the caller has a role in that organization on every request.
- Roles are organization-specific and composed from the permission catalog in
  `src/common/permissions.ts`. Role templates seed the common roles.
- Plan capacity (`max_organizations`, `max_users`, `max_projects`) is enforced by
  `PlanLimitService` inside a transaction that locks the subscription row, so a
  count-then-insert race cannot exceed the limit.
- Soft-deleted rows are excluded from normal reads and are permanently removed
  after `SOFT_DELETE_RETENTION_DAYS`.

The guard runs before pipes, so it validates the organization id itself and
answers `400` rather than letting an invalid UUID reach PostgreSQL as a `500`.

## 6. Data model and persistence

`src/common/entities.ts` is the single entity registry; `src/database/migrations.ts`
is the ordered migration list. The application and the TypeORM CLI both read
`src/database/data-source.ts`, so they cannot drift.

Core entity groups:

- **Identity**: `User`, `RefreshToken`, `UserSettings`.
- **Billing**: `Plan`, `Subscription`.
- **Tenancy**: `Organization`, `OrganizationSettings`, `Role`, `Permission`,
  `OrganizationInvitation`.
- **People**: `Team`, `TeamMember`, `Department`, `HumanResource`, `Employee`,
  `LeaveType`, `LeaveRequest`, `PerformanceReview`.
- **Delivery**: `Client`, `Project`, `Badge`, `Task`, `Subtask`, `Milestone`,
  `TimeEntry`, `TimeComplexity`.
- **Collaboration**: `ChatChannel`, `ChatChannelParticipant`, `ChatMessage`,
  `Comment`, `CommentMention`, `Attachment`, `Notification`,
  `NotificationEmail`, `Activity`.

Rules that hold across the schema:

- Primary keys are UUIDs.
- Foreign keys are real and cascade where the child cannot outlive the parent.
- Tenant tables are indexed by `organization_id` and their common sort keys.
- `synchronize` is always `false`; schema changes are migrations, reviewed like
  code and applied at boot or by the CLI.
- Soft-deletable tables use `deleted_at` and are filtered from normal reads.

## 7. Cross-cutting services

### Activity trail

The global interceptor puts `{ userId, organizationId }` into async-local
storage. Services call the free function `recordActivity(manager, event)` inside
the same transaction as the mutation it describes, so a successful write and its
audit event commit or roll back together. The activity module exposes
organization, project, task and entity timelines.

### Notifications and email outbox

In-app notifications are written directly. Emails are written to a durable
`notification_emails` outbox in the same transaction as the notification, then a
background worker claims due rows with `FOR UPDATE SKIP LOCKED`, sends them over
SMTP, and retries with exponential backoff. A failed send is a retryable row,
not a lost promise. The worker can be disabled with
`NOTIFICATION_EMAIL_INTERVAL_MS=0`, which the e2e suite uses.

### Attachments

Uploads are written under `uploads/` with UUID filenames, recorded in
`attachments`, and served through an authenticated download route. The URL is
not public: access still requires a valid token and organization membership.
The production compose file mounts the uploads volume at `/app/uploads`, which
is the path the service resolves from its working directory.

### Billing seam

`BillingProvider` isolates money movement from subscription rules.
`BillingModule` selects exactly one implementation:

- `stub` settles every purchase instantly, charges nothing, and logs a loud
  warning in production.
- `stripe` creates Checkout sessions and requires both `STRIPE_SECRET_KEY` and
  `STRIPE_WEBHOOK_SECRET`.

The webhook is public because Stripe authenticates it with a signature, not a
JWT. The controller verifies the signature against the raw body and then asks
the provider to resolve the reference; it never trusts a plan or amount from the
request. Applying a plan twice is prevented by provider idempotency plus the
subscription state checks.

### Mail

`MailService` owns SMTP and templates. In non-production, token-bearing flows
also return the raw token and link in the response (`verificationToken`,
`resetToken`, and so on) together with `emailSent`/`emailError`, so local flows
can be tested without SMTP. Production never exposes those fields.

### Rate limiting

`THROTTLE_ENABLED=true` turns on the global limiter. Buckets are configurable:
a general `default` bucket and a stricter `auth` bucket used by credential
routes. It is off by default because a developer machine and its tests share one
IP and would otherwise trip limits intended for the public internet. It must be
enabled on a real deployment.

### OpenAPI and health

Swagger is generated from the controllers and decorators, which is why
`x-permissions`, `x-auth` and the organization header appear in the document.
`GET /api/v1/health` is a liveness probe; `GET /api/v1` identifies the service.
The Docker `HEALTHCHECK` and the deploy workflow poll the health route before
declaring a release complete.

## 8. Realtime

Two Socket.IO namespaces run in the same process:

- `/realtime` — joins `task:<id>`, `subtask:<id>`, `project:<id>` and
  `org:<id>` rooms; handles typing indicators and pushes work-item changes.
- `/chat` — joins `org:<id>`, `user:<id>` and channel rooms; handles joins,
  leaves, typing and read markers.

Chat messages are written through the REST API, never through a socket event.
The service broadcasts after the database write, and the gateway re-checks
channel access on join. A socket whose membership was revoked can keep an old
room subscription until it reconnects, but it cannot write new messages because
the REST path re-checks permissions every time.

The gateways use the same JWT strategy as HTTP. `/realtime` verifies the token
and session directly in `handleConnection`; `/chat` resolves the full membership
and permission set before any room is joined.

## 9. Background work

Three in-process timers run inside the API container:

| Worker | Default | Control |
| --- | --- | --- |
| Refresh-token cleanup | every 6 hours | `SESSION_CLEANUP_INTERVAL_HOURS` |
| Soft-delete purge | every 24 hours | `PURGE_INTERVAL_HOURS`, retention in `SOFT_DELETE_RETENTION_DAYS` |
| Notification email delivery | every 15 seconds | `NOTIFICATION_EMAIL_INTERVAL_MS` and related settings |

They are delayed, `unref()`ed timers: they do not hold the process open and a
failure is logged rather than fatal. This design assumes a single API instance.
If the API is ever scaled horizontally, the notification outbox is already safe
to run in parallel because of its lease; the cleanup and purge workers would
merely do redundant work, not incorrect work.

## 10. Deployment shape

The production stack is two containers:

- `postgres` — private, persistent volume, health check.
- `api` — immutable image built by CI, environment from `/var/www/buildops/.env`,
  uploads volume, published only on `127.0.0.1:3100`.

The deploy workflow runs on a push to `main`:

1. malware scan;
2. dependency audit;
3. Docker image build and tag;
4. image shipped to the server with `docker load`;
5. compose file copied;
6. stack started, migrations applied by the entrypoint, health polled.

`develop` is the integration branch and never deploys. `main` is production and
is promoted from `develop` by the team leader. See `DEPLOYMENT.md` and
`CONTRIBUTING.md`.

## 11. Invariants to preserve

- Never enable `synchronize`; every schema change is a migration.
- Never trust an organization id without resolving membership.
- Never accept a non-access token as a bearer credential.
- Never store a refresh, reset, verification or invitation token in plaintext.
- Never expose the raw token in a production response.
- Never let a controller reach the database around its service.
- Keep tenant filters on every query that touches tenant data.
- Keep the payment provider behind `BILLING_PROVIDER`; a paid plan is applied by
  the subscription service, never by a request body.
- Keep secrets in the environment. `.env` is server-only and never committed.
