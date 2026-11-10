# Contributing to BuildOps

## 1. Scope and ownership

- This repository is the only codebase changed by contributors.
- `develop` is where all work lands.
- `main` is production and is owned by the team leader. Contributors do not push
  to it, merge into it, or deploy from it.
- The team leader promotes `develop` into `main`, runs the release and handles
  deployment.
- External repositories are references for ideas and documentation structure
  only. Do not copy code, assets or product identity from them.

## 2. Workflow

```
feature branch -> pull request -> develop -> (team leader) -> main -> deploy
```

1. Update your local `develop`:

   ```bash
   git switch develop
   git pull --ff-only origin develop
   ```

2. Create a focused branch:

   ```bash
   git switch -c feat/short-description
   ```

   Common prefixes: `feat/`, `fix/`, `refactor/`, `docs/`, `test/`, `chore/`.

3. Make the change, add or update tests, and run the checks locally.

4. Commit with a clear message. Use the imperative mood and describe the
   behavioural change, not the file touched:

   ```
   Add project resource allocation endpoint
   Fix refresh token reuse detection under concurrent refresh
   Document the production backup procedure
   ```

5. Push the branch and open a pull request into `develop`.

6. Address review comments by pushing more commits. Do not force-push a branch
   under review unless the reviewer asks for it.

7. Only the team leader opens and merges the `develop -> main` release pull
   request. The main source guard rejects any other source branch.

## 3. Before opening a pull request

Run the project checks:

```bash
pnpm install --frozen-lockfile
pnpm lint
pnpm test
pnpm run build
```

For changes that touch HTTP, database or authorization behaviour, also run the
relevant e2e suite. The suites need a PostgreSQL database; see
`test/jest-e2e.json` and the test setup under `test/setup`.

```bash
pnpm run test:e2e
```

If the change affects the API contract, regenerate and commit the OpenAPI
artifact:

```bash
pnpm run docs:openapi
```

The committed artifact is checked for drift by the test suite, so an API change
without the regenerated document is an incomplete change.

## 4. What a good change looks like

### Keep the module boundary

- HTTP concerns stay in controllers.
- Domain rules and transactions stay in services.
- Persistence stays in entities and repositories.
- Cross-module work goes through the owning service, not a direct repository
  query from another module.

### Protect the tenant boundary

- Every tenant-owned read and write filters by `organization_id`.
- Never trust `x-organization-id` without resolving membership.
- Use `@Protected()` and `@RequirePermissions(...)` for organization routes.
- Use `@SkipOrganization()` or `@BearerProfile()` only when the operation really
  is user- or subscription-level.

### Keep credentials safe

- Access tokens are bearer JWTs.
- Refresh, verification, reset and invitation tokens are purpose-bound, hashed
  at rest and single-use.
- Never return a raw token in a production response.
- Never log a secret, token, password or full environment value.
- Never commit `.env` or real credentials.

### Change the schema with a migration

- Create a migration for every schema change and register it in
  `src/database/migrations.ts`.
- Do not enable `synchronize`.
- Test both the upgrade and, where practical, the rollback.
- Keep migrations small enough to review and to reason about in production.

### Handle money through the provider seam

- Subscription rules do not call Stripe directly.
- A plan is applied by the subscription service after the provider confirms it.
- Never trust a plan id, price or amount from a webhook body; resolve the
  reference through the provider.
- Keep `stub` behaviour explicit; it grants paid plans for free and must never be
  mistaken for real billing.

### Keep documentation true

Update the relevant documents in the same pull request:

- `README.md` — product overview and quick start.
- `QUICKSTART.md` — shortest path to a running API.
- `INTEGRATION.md` and `docs/frontend-guide.md` — caller-facing behaviour.
- `docs/specification.md` — domain rules and workflow.
- `ARCHITECTURE_OVERVIEW.md` — system structure and invariants.
- `CONFIGURATION.md` — any new or changed environment variable.
- `DEPLOYMENT.md` / `BACKUP_RESTORE.md` — operational changes.
- `docs/openapi.json` — generated API contract.

A new environment variable must be added to `.env.example`, documented in
`CONFIGURATION.md`, and reflected in the production checklist where relevant.

### Tests that prove the behaviour

- Add a unit test for pure rules and guards.
- Add an e2e test for permissions, tenancy, error envelopes and multi-step
  flows.
- Reproduce the bug in a failing test before fixing it when possible.
- Do not weaken a test to make a change pass.

## 5. Commit and pull request hygiene

- One logical change per pull request.
- Do not mix formatting-only churn with behaviour changes.
- Do not commit generated build output, `dist/`, `node_modules/`, coverage or
  local uploads.
- Link the issue or describe the problem and the fix in the pull request.
- Include verification steps: commands run and what they returned.
- Call out migrations, environment changes or deployment steps explicitly.

## 6. Review checklist

- [ ] The change is limited to the intended scope.
- [ ] Tenant isolation and permission checks are present and tested.
- [ ] Input is validated by a DTO; no unvalidated body reaches a service.
- [ ] Errors use the existing envelope and appropriate status codes.
- [ ] New schema changes have a registered migration.
- [ ] New configuration is in `.env.example` and `CONFIGURATION.md`.
- [ ] OpenAPI artifact is regenerated when the contract changes.
- [ ] Lint, unit tests, build and relevant e2e tests pass.
- [ ] No secret, token or production value is committed.
- [ ] Documentation is updated.
