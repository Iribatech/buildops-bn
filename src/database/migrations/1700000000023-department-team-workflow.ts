import type { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Department and team ownership.
 *
 * A department names the person accountable for it, a team belongs to one
 * department, and a team names exactly one lead. Existing leadership rows in
 * `team_members` are used to backfill `teams.lead_user_id` so an organization
 * that already assigned a lead does not lose it when the column appears.
 */
export class DepartmentTeamWorkflow1700000000023 implements MigrationInterface {
  name = 'DepartmentTeamWorkflow1700000000023';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "departments"
      ADD COLUMN "head_user_id" uuid
    `);
    await queryRunner.query(`
      ALTER TABLE "departments"
      ADD CONSTRAINT "FK_departments_head_user"
      FOREIGN KEY ("head_user_id") REFERENCES "users" ("id") ON DELETE SET NULL
    `);
    await queryRunner.query(`
      CREATE INDEX "IDX_departments_head_user"
      ON "departments" ("head_user_id")
    `);

    await queryRunner.query(`
      ALTER TABLE "teams"
      ADD COLUMN "department_id" uuid
    `);
    await queryRunner.query(`
      ALTER TABLE "teams"
      ADD CONSTRAINT "FK_teams_department"
      FOREIGN KEY ("department_id") REFERENCES "departments" ("id")
      ON DELETE SET NULL
    `);
    await queryRunner.query(`
      CREATE INDEX "IDX_teams_org_department"
      ON "teams" ("organization_id", "department_id")
    `);

    await queryRunner.query(`
      ALTER TABLE "teams"
      ADD COLUMN "lead_user_id" uuid
    `);
    await queryRunner.query(`
      ALTER TABLE "teams"
      ADD CONSTRAINT "FK_teams_lead_user"
      FOREIGN KEY ("lead_user_id") REFERENCES "users" ("id") ON DELETE SET NULL
    `);
    await queryRunner.query(`
      CREATE INDEX "IDX_teams_lead_user"
      ON "teams" ("lead_user_id")
    `);

    await queryRunner.query(`
      UPDATE "teams" t
      SET "lead_user_id" = (
        SELECT tm."user_id"
        FROM "team_members" tm
        WHERE tm."team_id" = t."id"
          AND tm."role" = 'lead'
          AND tm."status" = 'active'
        ORDER BY tm."joined_at" ASC
        LIMIT 1
      )
      WHERE t."lead_user_id" IS NULL
    `);

    await queryRunner.query(`
      WITH template_permissions(template_key, permission_name, permission_description) AS (
        VALUES
          ('hr_manager', 'team.view', 'view team'),
          ('hr_manager', 'team.create', 'create team'),
          ('hr_manager', 'team.update', 'update team'),
          ('hr_manager', 'team.member.add', 'add team member'),
          ('hr_manager', 'team.member.remove', 'remove team member')
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
            WHEN 'Project Manager' THEN 'project_manager'
            ELSE NULL
          END
        )
      WHERE NOT EXISTS (
        SELECT 1 FROM "permissions" p
        WHERE p."role_id" = r."id" AND p."name" = tp.permission_name
      )
    `);

    await queryRunner.query(`
      DELETE FROM "permissions"
      WHERE "name" IN (
        'department.create', 'department.update',
        'team.update', 'team.member.add', 'team.member.remove'
      )
      AND "role_id" IN (
        SELECT "id" FROM "roles"
        WHERE "key" = 'project_manager'
          OR (COALESCE("key", '') = '' AND "name" = 'Project Manager')
      )
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      DELETE FROM "permissions"
      WHERE "name" IN (
        'team.view', 'team.create', 'team.update',
        'team.member.add', 'team.member.remove'
      )
      AND "role_id" IN (
        SELECT "id" FROM "roles"
        WHERE "key" = 'hr_manager'
          OR (COALESCE("key", '') = '' AND "name" = 'HR Manager')
      )
    `);

    await queryRunner.query(`
      WITH template_permissions(template_key, permission_name, permission_description) AS (
        VALUES
          ('project_manager', 'department.create', 'create department'),
          ('project_manager', 'department.update', 'update department'),
          ('project_manager', 'team.update', 'update team'),
          ('project_manager', 'team.member.add', 'add team member'),
          ('project_manager', 'team.member.remove', 'remove team member')
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
            WHEN 'Project Manager' THEN 'project_manager'
            ELSE NULL
          END
        )
      WHERE NOT EXISTS (
        SELECT 1 FROM "permissions" p
        WHERE p."role_id" = r."id" AND p."name" = tp.permission_name
      )
    `);

    await queryRunner.query(`DROP INDEX "IDX_teams_lead_user"`);
    await queryRunner.query(`
      ALTER TABLE "teams" DROP CONSTRAINT "FK_teams_lead_user"
    `);
    await queryRunner.query(`
      ALTER TABLE "teams" DROP COLUMN "lead_user_id"
    `);

    await queryRunner.query(`DROP INDEX "IDX_teams_org_department"`);
    await queryRunner.query(`
      ALTER TABLE "teams" DROP CONSTRAINT "FK_teams_department"
    `);
    await queryRunner.query(`
      ALTER TABLE "teams" DROP COLUMN "department_id"
    `);

    await queryRunner.query(`DROP INDEX "IDX_departments_head_user"`);
    await queryRunner.query(`
      ALTER TABLE "departments" DROP CONSTRAINT "FK_departments_head_user"
    `);
    await queryRunner.query(`
      ALTER TABLE "departments" DROP COLUMN "head_user_id"
    `);
  }
}
