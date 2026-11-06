import type { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Gives the HR Manager template the permissions the HR invite flow needs.
 *
 * HR already covered employees, departments and teams, but the invite dialog
 * asks the API to list roles (`role.view`), send invitations (`member.invite`)
 * and — when the administrator has not created the job title yet — create a
 * role definition (`role.create`). Without them the Employees page showed the
 * invite button and then failed on every call behind it.
 *
 * `role.create` is deliberately the only write permission here. The API caps a
 * created role to the permissions the creator already holds, so this cannot be
 * used to mint a wider role; changing, deleting and assigning roles remain
 * administrator actions.
 *
 * Existing organizations already have their HR Manager role rows, so the
 * permission rows are backfilled here rather than only in the template.
 */
export class HrRoleManagement1700000000025 implements MigrationInterface {
  name = 'HrRoleManagement1700000000025';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      WITH template_permissions(template_key, permission_name, permission_description) AS (
        VALUES
          ('hr_manager', 'member.invite', 'invite new members'),
          ('hr_manager', 'role.view', 'view roles and their permissions'),
          ('hr_manager', 'role.create', 'create new roles')
      )
      INSERT INTO "permissions" ("id", "role_id", "name", "description", "created_at", "updated_at")
      SELECT gen_random_uuid(), r."id", tp.permission_name, tp.permission_description, now(), now()
      FROM "roles" r
      JOIN template_permissions tp
        ON tp.template_key = r."key"
        OR (
          COALESCE(r."key", '') = ''
          AND tp.template_key = CASE r."name"
            WHEN 'HR Manager' THEN 'hr_manager'
            ELSE NULL
          END
        )
      WHERE NOT EXISTS (
        SELECT 1 FROM "permissions" p
        WHERE p."role_id" = r."id" AND p."name" = tp.permission_name
      )
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      DELETE FROM "permissions"
      WHERE "name" IN ('member.invite', 'role.view', 'role.create')
      AND "role_id" IN (
        SELECT "id" FROM "roles"
        WHERE "key" = 'hr_manager'
          OR (COALESCE("key", '') = '' AND "name" = 'HR Manager')
      )
    `);
  }
}
