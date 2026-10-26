import type { MigrationInterface, QueryRunner } from 'typeorm';

export class ProjectHumanResources1700000000016
  implements MigrationInterface
{
  name = 'ProjectHumanResources1700000000016';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE "project_human_resources" (
        "id" uuid NOT NULL DEFAULT gen_random_uuid(),
        "organization_id" uuid NOT NULL,
        "project_id" uuid NOT NULL,
        "name" character varying(255) NOT NULL,
        "email" character varying(255),
        "phone" character varying(50),
        "role" character varying(50) NOT NULL,
        "allocation_percent" integer NOT NULL DEFAULT 100,
        "hourly_rate" numeric(10,2),
        "start_date" date,
        "end_date" date,
        "notes" text,
        "status" character varying(50) NOT NULL DEFAULT 'active',
        "created_at" TIMESTAMP NOT NULL DEFAULT now(),
        "updated_at" TIMESTAMP NOT NULL DEFAULT now(),
        CONSTRAINT "PK_project_human_resources" PRIMARY KEY ("id"),
        CONSTRAINT "FK_project_human_resources_organization"
          FOREIGN KEY ("organization_id")
          REFERENCES "organizations" ("id") ON DELETE CASCADE,
        CONSTRAINT "FK_project_human_resources_project"
          FOREIGN KEY ("project_id")
          REFERENCES "projects" ("id") ON DELETE CASCADE,
        CONSTRAINT "CHK_project_human_resources_role"
          CHECK ("role" IN ('human_resource', 'finance_manager')),
        CONSTRAINT "CHK_project_human_resources_status"
          CHECK ("status" IN ('active', 'inactive')),
        CONSTRAINT "CHK_project_human_resources_allocation"
          CHECK ("allocation_percent" BETWEEN 1 AND 100)
      )
    `);

    await queryRunner.query(`
      CREATE INDEX "IDX_project_human_resources_project_name"
      ON "project_human_resources" ("organization_id", "project_id", "name")
    `);

    await queryRunner.query(`
      WITH template_permissions(template_key, permission_name, permission_description) AS (
        VALUES
          ('owner', 'human_resource.view', 'view project human resources'),
          ('owner', 'human_resource.create', 'add a person to a project'),
          ('owner', 'human_resource.update', 'update project human resources'),
          ('project_manager', 'human_resource.view', 'view project human resources'),
          ('project_manager', 'human_resource.create', 'add a person to a project'),
          ('project_manager', 'human_resource.update', 'update project human resources')
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
        'human_resource.view', 'human_resource.create', 'human_resource.update'
      )
      AND "role_id" IN (
        SELECT "id" FROM "roles" WHERE "key" IN ('owner', 'project_manager')
      )
    `);

    await queryRunner.query(`DROP TABLE "project_human_resources"`);
  }
}
