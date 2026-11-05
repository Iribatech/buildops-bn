# OfficeCore

**Run your office in one place** — clients, jobs/projects, tasks, time tracking, people, and everything your business needs to stay organized. Built for any type of company: agencies, consultancies, law firms, clinics, construction firms, and more.

## What it does

- **Business-first** — One subscription = your business account. Create as many companies/offices as your plan allows.
- **Clients & Jobs** — Keep track of clients, manage jobs/projects, and stay on top of deadlines
- **Tasks & Time** — Assign work, track progress, log time, and get a clear picture of where effort goes
- **People & Teams** — Manage employees, teams, departments, roles, and permissions with granular control
- **Leave & HR** — Handle leave requests, balances, and keep your team organized
- **Chat & Notifications** — Stay in sync with org, project, task, and direct messaging
- **Billing built-in** — Plans, trials, and Stripe integration ready out of the box
- **Secure by design** — JWT auth with rotating refresh tokens, CSRF protection, role-based access, and multi-tenant isolation

## Quick Start (5 Minutes)

The fastest way to try OfficeCore locally:

### 1) Clone and setup
```bash
git clone <your-repo-url>
cd ops
cp .env.example .env
pnpm install
```

### 2) Start database
```bash
docker compose -f docker-compose.dev.yml up -d
```

### 3) Setup database and run
```bash
pnpm run migration:run
pnpm run start:dev
```

The API will be running at `http://localhost:3000/api/v1`  
Swagger UI: `http://localhost:3000/api/v1/docs`

### First time setup flow

1. **Register** - `POST /api/v1/auth/register` with your email and password
2. **Verify email** - In development, the verification link/token is returned in the response
3. **Login** - `POST /api/v1/auth/login` to get your access token
4. **Subscribe** - `POST /api/v1/subscription` to start your free trial (or pick a plan)
5. **Create your office/company** - `POST /api/v1/organizations` to set up your first workspace
6. **Start working** - Add clients, create projects/jobs, invite your team

## API Overview

Base URL: `http://localhost:3000/api/v1`

Key endpoints:
- `POST /auth/register`, `POST /auth/login` - Authentication
- `GET /auth/me` - Get your profile
- `GET /subscription` - View your business subscription & usage
- `POST /subscription` - Subscribe to a plan (starts trial by default)
- `GET /organizations` - List your offices/companies
- `POST /organizations` - Create a new office/company
- `GET /clients`, `POST /clients` - Manage clients
- `GET /projects`, `POST /projects` - Manage jobs/projects
- `GET /tasks`, `POST /tasks` - Manage tasks
- `GET /time-entries` - Track time

## Environment

Copy `.env.example` to `.env`. Key settings:
- `DB_*` - PostgreSQL connection
- `JWT_SECRET` - Required for auth (generate with `openssl rand -hex 32`)
- `BILLING_PROVIDER` - `stub` for local dev, `stripe` for production
- `TRIAL_DAYS` - Free trial length (default: 14)
- `APP_BASE_URL` - For email links

In development, verification/reset tokens are returned in API responses for easy testing without SMTP.

## Development

```bash
pnpm run lint        # Lint code
pnpm test            # Run unit tests
pnpm run test:e2e    # Run e2e tests (needs PostgreSQL)
pnpm run build       # Build for production
pnpm run start:prod  # Run production build
```

## Tech Stack

NestJS • TypeORM • PostgreSQL • Socket.IO • Stripe • JWT

## Documentation

- Swagger UI: `http://localhost:3000/api/v1/docs`
- OpenAPI JSON: `http://localhost:3000/api/v1/docs-json`
