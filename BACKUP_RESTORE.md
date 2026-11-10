# Backup and Restore

BuildOps keeps persistent state in three places:

| State | Location | Recoverable from |
| --- | --- | --- |
| Application data | PostgreSQL volume `postgres_data` | Database dump |
| Attachments | Docker volume `uploads` (`/app/uploads`) | Archive of the volume |
| Configuration | `/var/www/buildops/.env` on the server | A secure secret store, not this repository |

The source code is in GitHub. A backup is not complete unless the database and
the uploads volume are from a compatible point in time.

## 1. Decide what a backup must cover

Minimum production backup:

- PostgreSQL dump.
- Uploads volume archive.
- A copy of the production `.env`, stored encrypted and separately.
- `docker-compose.prod.yml` (also in the repository).

Not covered by these commands:

- nginx configuration and TLS certificates (server-managed).
- Docker images (rebuildable from a commit).
- GitHub repository and workflow secrets.

## 2. Find the real volume names

The compose project is named `buildops`, so the volumes are normally:

```
buildops_postgres_data
buildops_uploads
```

Confirm on the server:

```bash
docker volume ls | grep buildops
docker compose -f /var/www/buildops/docker-compose.prod.yml ps
```

Use the names that actually exist. The commands below assume the defaults.

## 3. Create a backup

Run on the production server:

```bash
cd /var/www/buildops
mkdir -p backups
chmod 700 backups

STAMP=$(date -u +%Y%m%dT%H%M%SZ)
```

### 3.1 Stop writes for a consistent pair

The database and uploads are separate stores. Stopping the API freezes both
while the copies are taken:

```bash
docker compose -f docker-compose.prod.yml stop api
```

PostgreSQL can stay running; it is only being read by `pg_dump`.

### 3.2 Dump PostgreSQL

Use the custom format (`-Fc`); it is compressed and restores selectively.

```bash
docker compose -f docker-compose.prod.yml exec -T postgres \
  sh -c 'pg_dump -U "$POSTGRES_USER" -d "$POSTGRES_DB" -Fc' \
  > "backups/db-$STAMP.dump"
```

Verify the dump is non-empty and readable:

```bash
ls -lh "backups/db-$STAMP.dump"
docker compose -f docker-compose.prod.yml exec -T postgres \
  sh -c 'pg_restore --list' < "backups/db-$STAMP.dump" | head
```

### 3.3 Archive uploads

```bash
docker run --rm \
  -v buildops_uploads:/data:ro \
  -v "$PWD/backups":/backup \
  alpine \
  tar czf "/backup/uploads-$STAMP.tar.gz" -C /data .
```

Verify:

```bash
tar tzf "backups/uploads-$STAMP.tar.gz" | head
```

### 3.4 Restart the API

```bash
docker compose -f docker-compose.prod.yml start api
curl -fsS http://127.0.0.1:3100/api/v1/health
```

### 3.5 Back up `.env` separately

Do not put `.env` in the same archive as the database if that archive is stored
in a shared bucket. Encrypt it first:

```bash
gpg --symmetric --cipher-algo AES256 \
  --output "backups/env-$STAMP.gpg" /var/www/buildops/.env
```

Store the passphrase in a password manager, not next to the file. Never commit
`.env` or a backup to Git.

## 4. Copy backups off the server

A backup on the same disk is not a backup. Copy the files to another host or
object store, for example:

```bash
scp "backups/db-$STAMP.dump" "backups/uploads-$STAMP.tar.gz" \
  backup-host:/srv/backups/buildops/
```

Encrypt before uploading to object storage if the provider does not encrypt at
rest under your control.

Suggested retention:

- Daily database dumps for 14 days.
- Weekly backups for 8 weeks.
- At least one monthly backup kept longer.
- Keep the matching uploads archive with each database dump.

The practical interval depends on how much data loss is acceptable. Test the
restore, not just the backup.

## 5. Restore PostgreSQL

Restoring replaces the current database. Make sure this is what you want.

```bash
cd /var/www/buildops
STAMP=20261110T120000Z   # use the real stamp

docker compose -f docker-compose.prod.yml stop api
```

If the database was created by the compose stack and still exists, restore into
it with `--clean`:

```bash
docker compose -f docker-compose.prod.yml exec -T postgres \
  sh -c 'pg_restore -U "$POSTGRES_USER" -d "$POSTGRES_DB" --clean --if-exists --no-owner' \
  < "backups/db-$STAMP.dump"
```

If the database is missing or corrupt, recreate it first:

```bash
docker compose -f docker-compose.prod.yml exec -T postgres \
  sh -c 'dropdb -U "$POSTGRES_USER" --if-exists "$POSTGRES_DB" && createdb -U "$POSTGRES_USER" "$POSTGRES_DB"'

docker compose -f docker-compose.prod.yml exec -T postgres \
  sh -c 'pg_restore -U "$POSTGRES_USER" -d "$POSTGRES_DB" --no-owner' \
  < "backups/db-$STAMP.dump"
```

`dropdb` fails if other sessions are connected. The API is stopped, but check
for other clients first:

```bash
docker compose -f docker-compose.prod.yml exec postgres \
  sh -c 'psql -U "$POSTGRES_USER" -d postgres -c "select pid, usename, application_name from pg_stat_activity where datname = '\''$POSTGRES_DB'\'';"'
```

## 6. Restore uploads

With the API still stopped:

```bash
docker run --rm \
  -v buildops_uploads:/data \
  -v "$PWD/backups":/backup \
  alpine \
  sh -c 'rm -rf /data/* && tar xzf /backup/uploads-'"$STAMP"'.tar.gz -C /data'
```

This deletes the current uploads before extracting the archive. Confirm the
archive name before running it.

## 7. Start and verify

```bash
docker compose -f docker-compose.prod.yml up -d
docker compose -f docker-compose.prod.yml ps
docker compose -f docker-compose.prod.yml logs --tail 100 api
curl -fsS http://127.0.0.1:3100/api/v1/health
```

The entrypoint applies pending migrations. If the backup came from an older
schema, migrations bring it forward. If it came from a newer schema than the
running image, restore the matching image tag instead of migrating backwards.

Verify application-level data:

- Sign in with a known account.
- List organizations, projects and tasks.
- Download an existing attachment and confirm the file opens.
- Check the notification list and one activity timeline.

## 8. Restore to a separate environment first

For a rehearsal, restore into a throwaway compose project rather than
production:

```bash
mkdir -p /tmp/buildops-restore
cp /var/www/buildops/docker-compose.prod.yml /tmp/buildops-restore/
cp /var/www/buildops/.env /tmp/buildops-restore/.env
cd /tmp/buildops-restore
docker compose -p buildops-restore -f docker-compose.prod.yml up -d postgres
```

Then restore into that project's `postgres` service and uploads volume, using
the same commands with `-p buildops-restore` and a different uploads volume name.
This proves the dump restores without touching production.

Remove `/tmp/buildops-restore` when finished. It contains a copy of production
secrets:

```bash
docker compose -p buildops-restore -f /tmp/buildops-restore/docker-compose.prod.yml down -v
rm -rf /tmp/buildops-restore
```

## 9. Backup checklist

- [ ] Database dump created and listed successfully.
- [ ] Uploads archive created and listed successfully.
- [ ] Backup files copied off the server.
- [ ] `.env` stored encrypted and separately.
- [ ] Retention policy applied; old copies removed.
- [ ] Restore rehearsed in a non-production environment.
- [ ] Health and key flows verified after any real restore.
