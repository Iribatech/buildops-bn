# Deployment Guide

This document covers local environments, CI, the production Docker stack and
rollback. Configuration values are listed in `CONFIGURATION.md`.

## 1. Branch model

| Branch | Role |
| --- | --- |
| `develop` | Integration branch. All development and pull requests land here. It never deploys. |
| `main` | Production branch. A push to `main` deploys. Only the team leader promotes `develop` into it. |

Rules enforced by the repository:

- The production deploy workflow runs only on `push` to `main`.
- The main source guard fails any pull request into `main` that does not come
  from this repository's `develop` branch.
- Security scan and dependency audit run before the deploy job; a failure stops
  the release.

Contributors do not push to `main` and do not deploy. The workflow is described
in `CONTRIBUTING.md`.

## 2. Local development

### Option A: full stack with Docker

Requires Docker and Docker Compose only.

```bash
cp .env.example .env
# set JWT_SECRET in .env
docker compose up --build
```

- API: `http://localhost:3000/api/v1`
- Swagger UI: `http://localhost:3000/api/v1/docs`
- Health: `http://localhost:3000/api/v1/health`
- PostgreSQL: `localhost:5433`

Migrations run automatically in the container entrypoint. PostgreSQL data and
uploads live in named volumes, so `docker compose down` keeps them and
`docker compose down -v` deletes them.

### Option B: PostgreSQL in Docker, API on the host

Requires Node.js 22, pnpm 10 and Docker.

```bash
cp .env.example .env
pnpm install
docker compose -f docker-compose.dev.yml up -d
pnpm run migration:run
pnpm run db:seed
pnpm run start:dev
```

The dev compose file publishes PostgreSQL on `localhost:5432` and uses the
credentials from the file: `postgres` / `postgres` / `ops`.

### Database commands

```bash
pnpm run migration:run      # build, then apply pending migrations
pnpm run migration:show     # show migration status
pnpm run migration:revert   # roll back the last migration
pnpm run db:seed            # seed base data
pnpm run db:setup           # migration:run + db:seed
```

Migrations are versioned and committed. Never change the schema through
`synchronize`; it is disabled on purpose.

## 3. CI pipeline

### On pull requests

- `security-malware-scan.yml` scans priority files, all source files and
  heuristic indicators.
- `audit.yml` runs `pnpm audit --audit-level=high`.
- `main-source-guard.yml` runs on pull requests into `main` and rejects any head
  branch other than `develop` from this repository.

### On push to main

1. **Scan** — malware scan must pass.
2. **Audit** — dependency audit must pass.
3. **Deploy**:
   - checks out `main`;
   - builds `buildops-api:<12-char-sha>` and `buildops-api:latest`;
   - configures SSH with `SSH_PRIVATE_KEY`, `SERVER_HOST`, `SERVER_USER`;
   - verifies Docker, the Compose plugin and `/var/www/buildops/.env`;
   - streams the image to the server with `docker save | ssh 'docker load'`;
   - copies `docker-compose.prod.yml`;
   - starts the stack and polls the health route for up to 90 seconds;
   - removes old image tags, keeping the newly deployed tag and `latest`.

The server never builds the application. This matters because the host is small
and shared with other sites.

## 4. Production stack

The production compose project is named `buildops` and consists of:

| Service | Image | Exposure |
| --- | --- | --- |
| `postgres` | `postgres:16-alpine` | No published port; reachable only on the compose network. |
| `api` | `buildops-api:${IMAGE_TAG:-latest}` | `127.0.0.1:3100` on the host. nginx fronts the public domain. |

Persistent state:

- `postgres_data` volume — database files.
- `uploads` volume — attachment files at `/app/uploads`.

The application environment comes from `/var/www/buildops/.env`, which is
created and maintained by hand on the server. Deploy never creates or overwrites
it. Production compose overrides `NODE_ENV=production`, `PORT=3000`,
`DB_HOST=postgres` and `DB_PORT=5432`.

### Server prerequisites

- Docker Engine with the Compose plugin.
- `/var/www/buildops/.env` containing at least `DB_USERNAME`, `DB_PASSWORD` and
  `DB_DATABASE`, plus the production application settings from
  `CONFIGURATION.md`.
- An nginx vhost for the public host that proxies to `127.0.0.1:3100` and
  upgrades WebSocket connections for `/realtime` and `/chat`.
- Repository secrets `SSH_PRIVATE_KEY`, `SERVER_HOST`, `SERVER_USER`.

The workflow pins the server host key. If the server is rebuilt, update the
pinned key in `.github/workflows/deploy-master.yml` from:

```bash
ssh-keyscan -t ed25519 buildopbn.kazilink.online
```

### First start

```bash
cd /var/www/buildops
cp /path/to/repository/.env.example .env
# edit .env with production values
chmod 600 .env
docker compose -f docker-compose.prod.yml up -d
```

The entrypoint runs pending migrations before the API starts. `RUN_MIGRATIONS=false`
skips that when migrations are handled separately.

## 5. Verifying a deployment

From the server:

```bash
curl -fsS http://127.0.0.1:3100/api/v1/health
docker compose -f docker-compose.prod.yml ps
docker compose -f docker-compose.prod.yml logs --tail 100 api
```

Through the public host:

```bash
curl -fsS https://buildopbn.kazilink.online/api/v1/health
```

A healthy deployment answers:

```json
{
  "status": "ok",
  "service": "officecore-api",
  "version": "1.0",
  "timestamp": "..."
}
```

The Docker image also has its own `HEALTHCHECK` against the same route.

## 6. Rollback

The deploy workflow prunes older image tags, so the previous image usually no
longer exists on the server. The reliable rollback is to revert the change on
`develop` and promote the revert through `main`:

```bash
git switch develop
git pull --ff-only
git revert <bad-commit>
git push origin develop
# team leader opens develop -> main and merges
```

If the previous image is still present on the server, it can be started
manually:

```bash
cd /var/www/buildops
docker images buildops-api
IMAGE_TAG=<previous-tag> docker compose -f docker-compose.prod.yml up -d
```

This is a stopgap. The repository must still contain the revert, or the next
deploy will ship the bad commit again.

A database migration is harder to undo than an image. Before promoting a release
that changes the schema, take a backup (see `BACKUP_RESTORE.md`). `migration:revert`
exists, but production rollback should be planned per migration rather than
assumed.

## 7. Troubleshooting

| Symptom | Likely cause | Action |
| --- | --- | --- |
| Deploy stops at "Verify server prerequisites" | Missing `DB_USERNAME`, `DB_PASSWORD` or `DB_DATABASE` in `/var/www/buildops/.env`, or Docker/Compose missing | Fix `.env` on the server; never commit it. |
| API boots and exits immediately | Missing `JWT_SECRET` or `ALLOWED_ORIGINS` in production, or invalid `BILLING_PROVIDER` / missing Stripe keys | Read the API log; the error names the variable. |
| Health poll times out | Migration failure, database unreachable, port conflict, or application boot error | The workflow prints `docker compose ps` and the last 80 API log lines. |
| Login works but refresh fails behind the proxy | Cookies or CORS misconfigured | `ALLOWED_ORIGINS` must be the exact frontend origin; the API sends credentialed CORS responses. |
| Realtime does not connect through nginx | Missing WebSocket upgrade headers | Configure nginx to upgrade `/realtime` and `/chat`. |
| Uploads disappear after redeploy | Uploads volume not mounted or removed with `down -v` | Check the `uploads` volume in the compose project. |
| Emails never arrive | SMTP settings wrong or unreachable | Check `[MailService]` errors in the API log; non-production responses report `emailSent`/`emailError`. |
| Notification emails accumulate as `pending` | Worker disabled or SMTP down | Check `NOTIFICATION_EMAIL_INTERVAL_MS` and the API log. |

## 8. Release checklist

- [ ] Change merged into `develop` and tests pass.
- [ ] `pnpm lint`, `pnpm test` and relevant e2e suites pass.
- [ ] New environment variables are added to `.env.example` and documented.
- [ ] Migration is committed and tested on a copy of real data.
- [ ] Backup taken before a destructive schema change.
- [ ] Team leader opens `develop -> main`, scans and audit pass.
- [ ] Deploy health check passes.
- [ ] Health endpoint and key flows verified through the public host.
