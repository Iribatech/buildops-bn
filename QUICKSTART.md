# Quick Start Guide

Get OfficeCore running in 5 minutes.

## Prerequisites
- Node.js 18+ 
- pnpm 10+
- Docker (for PostgreSQL) or a running PostgreSQL instance

## Steps

### 1. Install dependencies
```bash
pnpm install
```

### 2. Set up environment
```bash
cp .env.example .env
```

The defaults work for local development with the docker setup below.

### 3. Start PostgreSQL
```bash
docker compose -f docker-compose.dev.yml up -d
```

Wait a few seconds for it to be ready.

### 4. Set up database
```bash
pnpm run migration:run
pnpm run db:seed
```

### 5. Start the API
```bash
pnpm run start:dev
```

Visit http://localhost:3000/api/v1/docs for the full API documentation.

## First-time user flow

1. **Register**: `POST /api/v1/auth/register` 
   ```json
   {
     "email": "owner@yourcompany.com",
     "password": "password123",
     "name": "Your Name"
   }
   ```
   In dev mode, you'll get `verificationToken` and `verificationLink` in the response.

2. **Verify email**: `GET /api/v1/auth/verify-email?token=<token>` or use the link

3. **Login**: `POST /api/v1/auth/login`
   ```json
   {
     "email": "owner@yourcompany.com",
     "password": "password123"
   }
   ```
   You'll get an `access_token`. Save it for authenticated requests.

4. **Subscribe to a plan**: `POST /api/v1/subscription`
   ```json
   {
     "planId": "<free-plan-id>",
     "status": "trial"
   }
   ```
   Get plan IDs from `GET /api/v1/plan` or after seeding.

5. **Create your company/office**: `POST /api/v1/organizations`
   ```json
   {
     "name": "Acme Consulting"
   }
   ```
   Include header: `Authorization: Bearer <access_token>`

6. **Start using it**: Add clients, create projects/jobs, manage tasks, track time!

## Tips
- All authenticated org-scoped routes need the `x-organization-id` header or organization context
- In development, email tokens are exposed in responses for easy testing
- Use the Swagger UI at `/api/v1/docs` to explore and test all endpoints
