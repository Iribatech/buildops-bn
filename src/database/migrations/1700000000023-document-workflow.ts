import type { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Turns work documentation from a single text record into a reviewable one:
 * a reviewer can send a document back, every write carries a revision, the
 * work itself can be dated and timed, project visibility exists, and files can
 * be attached to the document rather than only to a task.
 */
export class DocumentWorkflow1700000000023 implements MigrationInterface {
  name = 'DocumentWorkflow1700000000023';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "documents"
        ADD COLUMN "visibility" character varying(20) NOT NULL DEFAULT 'organization',
        ADD COLUMN "revision" integer NOT NULL DEFAULT 1,
        ADD COLUMN "work_date" date,
        ADD COLUMN "hours" numeric(5,2),
        ADD COLUMN "reviewed_by" uuid,
        ADD COLUMN "reviewed_at" TIMESTAMP,
        ADD COLUMN "review_note" text
    `);

    await queryRunner.query(`
      ALTER TABLE "documents"
        ADD CONSTRAINT "FK_documents_reviewed_by"
        FOREIGN KEY ("reviewed_by")
        REFERENCES "users" ("id") ON DELETE SET NULL
    `);

    await queryRunner.query(`
      ALTER TABLE "documents" DROP CONSTRAINT "CHK_documents_status"
    `);
    await queryRunner.query(`
      ALTER TABLE "documents"
        ADD CONSTRAINT "CHK_documents_status"
        CHECK ("status" IN ('draft', 'submitted', 'changes_requested', 'approved', 'archived'))
    `);
    await queryRunner.query(`
      ALTER TABLE "documents"
        ADD CONSTRAINT "CHK_documents_visibility"
        CHECK ("visibility" IN ('organization', 'project'))
    `);
    await queryRunner.query(`
      ALTER TABLE "documents"
        ADD CONSTRAINT "CHK_documents_hours"
        CHECK ("hours" IS NULL OR ("hours" >= 0 AND "hours" <= 24))
    `);
    await queryRunner.query(`
      ALTER TABLE "documents"
        ADD CONSTRAINT "CHK_documents_revision"
        CHECK ("revision" >= 1)
    `);

    await queryRunner.query(`
      CREATE INDEX "IDX_documents_org_visibility"
      ON "documents" ("organization_id", "visibility")
    `);

    await queryRunner.query(`
      ALTER TABLE "attachments"
        ADD COLUMN "document_id" uuid
    `);
    await queryRunner.query(`
      ALTER TABLE "attachments"
        ADD CONSTRAINT "FK_attachments_document"
        FOREIGN KEY ("document_id")
        REFERENCES "documents" ("id") ON DELETE CASCADE
    `);
    await queryRunner.query(`
      CREATE INDEX "IDX_attachments_document"
      ON "attachments" ("document_id")
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX "IDX_attachments_document"`);
    await queryRunner.query(`
      ALTER TABLE "attachments" DROP CONSTRAINT "FK_attachments_document"
    `);
    await queryRunner.query(`
      ALTER TABLE "attachments" DROP COLUMN "document_id"
    `);

    await queryRunner.query(`DROP INDEX "IDX_documents_org_visibility"`);

    await queryRunner.query(`
      ALTER TABLE "documents" DROP CONSTRAINT "CHK_documents_revision"
    `);
    await queryRunner.query(`
      ALTER TABLE "documents" DROP CONSTRAINT "CHK_documents_hours"
    `);
    await queryRunner.query(`
      ALTER TABLE "documents" DROP CONSTRAINT "CHK_documents_visibility"
    `);
    await queryRunner.query(`
      ALTER TABLE "documents" DROP CONSTRAINT "CHK_documents_status"
    `);
    await queryRunner.query(`
      UPDATE "documents" SET "status" = 'draft' WHERE "status" = 'changes_requested'
    `);
    await queryRunner.query(`
      ALTER TABLE "documents"
        ADD CONSTRAINT "CHK_documents_status"
        CHECK ("status" IN ('draft', 'submitted', 'approved', 'archived'))
    `);

    await queryRunner.query(`
      ALTER TABLE "documents" DROP CONSTRAINT "FK_documents_reviewed_by"
    `);
    await queryRunner.query(`
      ALTER TABLE "documents"
        DROP COLUMN "review_note",
        DROP COLUMN "reviewed_at",
        DROP COLUMN "reviewed_by",
        DROP COLUMN "hours",
        DROP COLUMN "work_date",
        DROP COLUMN "revision",
        DROP COLUMN "visibility"
    `);
  }
}
