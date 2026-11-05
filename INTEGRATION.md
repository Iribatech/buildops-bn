# Frontend Integration Guide

## Quick Start

### Base URL
```js
const API_BASE = 'http://localhost:3000/api/v1';
```

### Required Setup

All requests need:
- `Content-Type: application/json`
- For authenticated requests: `Authorization: Bearer <access_token>`
- For org-scoped requests: `x-organization-id: <organizationId>`
- For requests with cookies (login/refresh/logout): `credentials: 'include'` (axios) or `credentials: 'include'` (fetch)

### Auth Flow

1. **Register** - `POST /auth/register`
```json
{ "email": "user@example.com", "password": "Password123!", "name": "John Doe" }
```
In dev, response includes `verificationToken`/`verificationLink`.

2. **Verify Email** - `GET /auth/verify-email?token=<token>`

3. **Login** - `POST /auth/login` (with credentials: include)
```json
{ "email": "user@example.com", "password": "Password123!" }
```
Returns `{ access_token: "..." }` and sets httpOnly refresh cookie.

4. **Get Profile** - `GET /auth/me` with Bearer token

5. **Refresh Token** - `POST /auth/refresh` (with credentials: include, needs CSRF token)
```js
headers: { 'x-csrf-token': getCsrfFromCookie() }
```

6. **Logout** - `POST /auth/logout` (with credentials: include)

### Onboarding Flow

After login:
1. Check subscription: `GET /subscription` (returns 404 if no subscription)
2. If no subscription: `POST /subscription` with `{ planId: "...", status: "trial" }`
3. Check organizations: `GET /organizations`
4. If none: `POST /organizations` with `{ name: "My Company" }`
5. Use `x-organization-id` header for all org-scoped operations

### Key Endpoints

| Endpoint | Method | Auth | Notes |
|----------|--------|------|-------|
| `/health` | GET | No | Health check |
| `/auth/register` | POST | No | Create account |
| `/auth/login` | POST | No | Login, sets cookies |
| `/auth/me` | GET | Yes | Current user |
| `/subscription` | GET/POST | Yes | Business subscription |
| `/organizations` | GET/POST | Yes | List/create offices |
| `/clients` | GET/POST | Yes + Org | Manage clients |
| `/projects` | GET/POST | Yes + Org | Manage jobs/projects |
| `/tasks` | GET/POST | Yes + Org | Manage tasks |
| `/time-entries` | GET/POST | Yes + Org | Track time |
| `/dashboard` | GET | Yes + Org | Dashboard data |

### Error Handling

All errors follow this format:
```json
{
  "statusCode": 400,
  "message": "Error message" // or ["field error 1", "field error 2"]
}
```

Common status codes:
- `400` - Bad request / validation error
- `401` - Unauthorized (missing/invalid token)
- `403` - Forbidden (no permission or unverified email)
- `404` - Not found
- `409` - Conflict
- `429` - Rate limited

### CORS & Cookies

In development, CORS allows all origins. For cookies to work:
- Use `withCredentials: true` in axios
- Or `credentials: 'include'` in fetch
- Refresh/logout need CSRF token from `csrf` cookie sent as `x-csrf-token` header

### Tips for Frontend

- Use the Swagger UI at `/api/v1/docs` to test all endpoints
- Generate TypeScript types from OpenAPI: `openapi-typescript http://localhost:3000/api/v1/docs-json`
- Store access token in memory (not localStorage for better security)
- Handle token refresh on 401 errors
- Always include `x-organization-id` header for org-scoped routes
