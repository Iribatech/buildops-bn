import type { MigrationInterface, QueryRunner } from 'typeorm';

export class Departments1700000000017 implements MigrationInterface {
  name = 'Departments1700000000017';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE "departments" (
        "id" uuid NOT NULL DEFAULT gen_random_uuid(),
        "organization_id" uuid NOT NULL,
        "name" character varying(255) NOT NULL,
        "description" text,
        "status" character varying(50) NOT NULL DEFAULT 'active',
        "created_at" TIMESTAMP NOT NULL DEFAULT now(),
        "updated_at" TIMESTAMP NOT NULL DEFAULT now(),
        CONSTRAINT "PK_departments" PRIMARY KEY ("id"),
        CONSTRAINT "FK_departments_organization" FOREIGN KEY ("organization_id")
          REFERENCES "organizations" ("id") ON DELETE CASCADE,
        CONSTRAINT "CHK_departments_status"
          CHECK ("status" IN ('active', 'inactive'))
      )
    `);

    await queryRunner.query(`
      CREATE INDEX "IDX_departments_org_name"
      ON "departments" ("organization_id", "name")
    `);

    await queryRunner.query(`
      WITH template_permissions(template_key, permission_name, permission_description) AS (
        VALUES
          ('owner', 'department.view', 'view department'),
          ('owner', 'department.create', 'create department'),
          ('owner', 'department.update', 'update department'),
          ('project_manager', 'department.view', 'view department'),
          ('project_manager', 'department.create', 'create department'),
          ('project_manager', 'department.update', 'update department'),
          ('developer', 'department.view', 'view department'),
          ('tester', 'department.view', 'view department'),
          ('viewer', 'department.view', 'view department')
      )
      INSERT INTO "permissions" ("id", "role_id", "name", "description", "created_at", "updated_at")
      SELECT gen_random_uuid(), r."id", tp.permission_name, tp.permission_description, now(), now()
      FROM "roles" r
      JOIN template_permissions tp ON tp.template_key = r."key"
      WHERE NOT EXISTS (
        SELECT 1 FROM "permissions" p
        WHERE p."role_id" = r."id" AND p."name" = tp.permission_name
      )
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      DELETE FROM "permissions"
      WHERE "name" IN (
        'department.view', 'department.create', 'department.update'
      )
      AND "role_id" IN (
        SELECT "id" FROM "roles"
        WHERE "key" IN ('owner', 'project_manager', 'developer', 'tester', 'viewer')
      )
    `);

    await queryRunner.query(`DROP INDEX "IDX_departments_org_name"`);
    await queryRunner.query(`DROP TABLE "departments"`);
  }
}
