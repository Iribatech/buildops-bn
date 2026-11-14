import type { MigrationInterface, QueryRunner } from 'typeorm';

export class Documents1700000000022 implements MigrationInterface {
  name = 'Documents1700000000022';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE "documents" (
        "id" uuid NOT NULL DEFAULT gen_random_uuid(),
        "organization_id" uuid NOT NULL,
        "project_id" uuid,
        "task_id" uuid,
        "author_id" uuid,
        "type" character varying(50) NOT NULL DEFAULT 'work_report',
        "title" character varying(255) NOT NULL,
        "body" text NOT NULL DEFAULT '',
        "status" character varying(50) NOT NULL DEFAULT 'draft',
        "current_version" integer NOT NULL DEFAULT 1,
        "submitted_at" TIMESTAMP,
        "approved_at" TIMESTAMP,
        "approved_by" uuid,
        "created_at" TIMESTAMP NOT NULL DEFAULT now(),
        "updated_at" TIMESTAMP NOT NULL DEFAULT now(),
        "deleted_at" TIMESTAMP,
        "deleted_by" uuid,
        CONSTRAINT "PK_documents" PRIMARY KEY ("id"),
        CONSTRAINT "FK_documents_organization"
          FOREIGN KEY ("organization_id")
          REFERENCES "organizations" ("id") ON DELETE CASCADE,
        CONSTRAINT "FK_documents_project"
          FOREIGN KEY ("project_id")
          REFERENCES "projects" ("id") ON DELETE SET NULL,
        CONSTRAINT "FK_documents_task"
          FOREIGN KEY ("task_id")
          REFERENCES "tasks" ("id") ON DELETE SET NULL,
        CONSTRAINT "FK_documents_author"
          FOREIGN KEY ("author_id")
          REFERENCES "users" ("id") ON DELETE SET NULL,
        CONSTRAINT "FK_documents_approved_by"
          FOREIGN KEY ("approved_by")
          REFERENCES "users" ("id") ON DELETE SET NULL,
        CONSTRAINT "CHK_documents_type"
          CHECK ("type" IN ('work_report', 'daily_log', 'sop', 'meeting_notes', 'handover', 'other')),
        CONSTRAINT "CHK_documents_status"
          CHECK ("status" IN ('draft', 'submitted', 'approved', 'archived')),
        CONSTRAINT "CHK_documents_current_version"
          CHECK ("current_version" >= 1)
      )
    `);

    await queryRunner.query(`
      CREATE INDEX "IDX_documents_org_created"
      ON "documents" ("organization_id", "created_at")
    `);
    await queryRunner.query(`
      CREATE INDEX "IDX_documents_org_project"
      ON "documents" ("organization_id", "project_id")
    `);
    await queryRunner.query(`
      CREATE INDEX "IDX_documents_org_task"
      ON "documents" ("organization_id", "task_id")
    `);
    await queryRunner.query(`
      CREATE INDEX "IDX_documents_org_status"
      ON "documents" ("organization_id", "status")
    `);
    await queryRunner.query(`
      CREATE INDEX "IDX_documents_org_author"
      ON "documents" ("organization_id", "author_id")
    `);

    await queryRunner.query(`
      CREATE TABLE "document_versions" (
        "id" uuid NOT NULL DEFAULT gen_random_uuid(),
        "document_id" uuid NOT NULL,
        "version" integer NOT NULL,
        "title" character varying(255) NOT NULL,
        "body" text NOT NULL,
        "edited_by" uuid,
        "created_at" TIMESTAMP NOT NULL DEFAULT now(),
        CONSTRAINT "PK_document_versions" PRIMARY KEY ("id"),
        CONSTRAINT "FK_document_versions_document"
          FOREIGN KEY ("document_id")
          REFERENCES "documents" ("id") ON DELETE CASCADE,
        CONSTRAINT "FK_document_versions_edited_by"
          FOREIGN KEY ("edited_by")
          REFERENCES "users" ("id") ON DELETE SET NULL,
        CONSTRAINT "CHK_document_versions_version"
          CHECK ("version" >= 1)
      )
    `);

    await queryRunner.query(`
      CREATE UNIQUE INDEX "UQ_document_versions_document_version"
      ON "document_versions" ("document_id", "version")
    `);
    await queryRunner.query(`
      CREATE INDEX "IDX_document_versions_document"
      ON "document_versions" ("document_id")
    `);

    await queryRunner.query(`
      WITH template_permissions(template_key, permission_name, permission_description) AS (
        VALUES
          ('owner', 'document.view', 'view work documentation'),
          ('owner', 'document.create', 'create work documentation'),
          ('owner', 'document.update', 'edit work documentation'),
          ('owner', 'document.delete', 'delete work documentation'),
          ('owner', 'document.approve', 'approve submitted work documentation'),
          ('project_manager', 'document.view', 'view work documentation'),
          ('project_manager', 'document.create', 'create work documentation'),
          ('project_manager', 'document.update', 'edit work documentation'),
          ('project_manager', 'document.delete', 'delete work documentation'),
          ('project_manager', 'document.approve', 'approve submitted work documentation'),
          ('developer', 'document.view', 'view work documentation'),
          ('developer', 'document.create', 'create work documentation'),
          ('developer', 'document.update', 'edit work documentation'),
          ('tester', 'document.view', 'view work documentation'),
          ('tester', 'document.create', 'create work documentation'),
          ('tester', 'document.update', 'edit work documentation'),
          ('hr_manager', 'document.view', 'view work documentation'),
          ('hr_manager', 'document.create', 'create work documentation'),
          ('hr_manager', 'document.update', 'edit work documentation'),
          ('viewer', 'document.view', 'view work documentation')
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
        'document.view', 'document.create', 'document.update',
        'document.delete', 'document.approve'
      )
      AND "role_id" IN (
        SELECT "id" FROM "roles"
        WHERE "key" IN (
          'owner', 'project_manager', 'developer', 'tester', 'hr_manager', 'viewer'
        )
      )
    `);

    await queryRunner.query(`
      DROP INDEX "IDX_document_versions_document"
    `);
    await queryRunner.query(`
      DROP INDEX "UQ_document_versions_document_version"
    `);
    await queryRunner.query(`DROP TABLE "document_versions"`);

    await queryRunner.query(`
      DROP INDEX "IDX_documents_org_author"
    `);
    await queryRunner.query(`
      DROP INDEX "IDX_documents_org_status"
    `);
    await queryRunner.query(`
      DROP INDEX "IDX_documents_org_task"
    `);
    await queryRunner.query(`
      DROP INDEX "IDX_documents_org_project"
    `);
    await queryRunner.query(`
      DROP INDEX "IDX_documents_org_created"
    `);
    await queryRunner.query(`DROP TABLE "documents"`);
  }
}
