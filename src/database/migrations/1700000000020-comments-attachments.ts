import type { MigrationInterface, QueryRunner } from 'typeorm';

export class CommentsAttachments1700000000020 implements MigrationInterface {
  name = 'CommentsAttachments1700000000020';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE "comments" (
        "id" uuid NOT NULL DEFAULT gen_random_uuid(),
        "organization_id" uuid NOT NULL,
        "project_id" uuid,
        "task_id" uuid,
        "subtask_id" uuid,
        "author_id" uuid NOT NULL,
        "content" text NOT NULL,
        "edited_at" TIMESTAMP,
        "created_at" TIMESTAMP NOT NULL DEFAULT now(),
        "updated_at" TIMESTAMP NOT NULL DEFAULT now(),
        "deleted_at" TIMESTAMP,
        CONSTRAINT "PK_comments" PRIMARY KEY ("id"),
        CONSTRAINT "FK_comments_organization" FOREIGN KEY ("organization_id") REFERENCES "organizations" ("id") ON DELETE CASCADE,
        CONSTRAINT "FK_comments_project" FOREIGN KEY ("project_id") REFERENCES "projects" ("id") ON DELETE SET NULL,
        CONSTRAINT "FK_comments_task" FOREIGN KEY ("task_id") REFERENCES "tasks" ("id") ON DELETE CASCADE,
        CONSTRAINT "FK_comments_subtask" FOREIGN KEY ("subtask_id") REFERENCES "subtasks" ("id") ON DELETE CASCADE,
        CONSTRAINT "FK_comments_author" FOREIGN KEY ("author_id") REFERENCES "users" ("id") ON DELETE CASCADE
      )
    `);

    await queryRunner.query(`CREATE INDEX "IDX_comments_org_created" ON "comments" ("organization_id", "created_at")`);
    await queryRunner.query(`CREATE INDEX "IDX_comments_task_created" ON "comments" ("task_id", "created_at")`);
    await queryRunner.query(`CREATE INDEX "IDX_comments_subtask_created" ON "comments" ("subtask_id", "created_at")`);

    await queryRunner.query(`
      CREATE TABLE "comment_mentions" (
        "id" uuid NOT NULL DEFAULT gen_random_uuid(),
        "comment_id" uuid NOT NULL,
        "mentioned_user_id" uuid NOT NULL,
        "organization_id" uuid NOT NULL,
        "created_at" TIMESTAMP NOT NULL DEFAULT now(),
        CONSTRAINT "PK_comment_mentions" PRIMARY KEY ("id"),
        CONSTRAINT "FK_comment_mentions_comment" FOREIGN KEY ("comment_id") REFERENCES "comments" ("id") ON DELETE CASCADE,
        CONSTRAINT "FK_comment_mentions_user" FOREIGN KEY ("mentioned_user_id") REFERENCES "users" ("id") ON DELETE CASCADE
      )
    `);

    await queryRunner.query(`CREATE INDEX "IDX_comment_mentions_comment" ON "comment_mentions" ("comment_id")`);
    await queryRunner.query(`CREATE INDEX "IDX_comment_mentions_user" ON "comment_mentions" ("mentioned_user_id")`);

    await queryRunner.query(`
      CREATE TABLE "attachments" (
        "id" uuid NOT NULL DEFAULT gen_random_uuid(),
        "organization_id" uuid NOT NULL,
        "project_id" uuid,
        "task_id" uuid,
        "subtask_id" uuid,
        "comment_id" uuid,
        "uploader_id" uuid NOT NULL,
        "original_name" character varying(255) NOT NULL,
        "file_name" character varying(255) NOT NULL,
        "mime_type" character varying(127) NOT NULL,
        "size" bigint NOT NULL,
        "path" character varying(512) NOT NULL,
        "kind" character varying(32) NOT NULL DEFAULT 'file',
        "created_at" TIMESTAMP NOT NULL DEFAULT now(),
        "deleted_at" TIMESTAMP,
        CONSTRAINT "PK_attachments" PRIMARY KEY ("id"),
        CONSTRAINT "FK_attachments_organization" FOREIGN KEY ("organization_id") REFERENCES "organizations" ("id") ON DELETE CASCADE,
        CONSTRAINT "FK_attachments_project" FOREIGN KEY ("project_id") REFERENCES "projects" ("id") ON DELETE SET NULL,
        CONSTRAINT "FK_attachments_task" FOREIGN KEY ("task_id") REFERENCES "tasks" ("id") ON DELETE CASCADE,
        CONSTRAINT "FK_attachments_subtask" FOREIGN KEY ("subtask_id") REFERENCES "subtasks" ("id") ON DELETE CASCADE,
        CONSTRAINT "FK_attachments_comment" FOREIGN KEY ("comment_id") REFERENCES "comments" ("id") ON DELETE CASCADE,
        CONSTRAINT "FK_attachments_uploader" FOREIGN KEY ("uploader_id") REFERENCES "users" ("id") ON DELETE CASCADE
      )
    `);

    await queryRunner.query(`CREATE INDEX "IDX_attachments_org_created" ON "attachments" ("organization_id", "created_at")`);
    await queryRunner.query(`CREATE INDEX "IDX_attachments_task" ON "attachments" ("task_id")`);
    await queryRunner.query(`CREATE INDEX "IDX_attachments_comment" ON "attachments" ("comment_id")`);

    await queryRunner.query(`
      INSERT INTO "permissions" ("id", "role_id", "name", "description", "created_at", "updated_at")
      SELECT gen_random_uuid(), r."id", p.permission_name, p.permission_description, now(), now()
      FROM "roles" r
      CROSS JOIN (VALUES
        ('task:view', 'view tasks and comments'),
        ('task:update', 'update tasks and comments')
      ) AS p(permission_name, permission_description)
      WHERE r."key" IN ('owner', 'project_manager', 'member')
      AND NOT EXISTS (SELECT 1 FROM "permissions" pr WHERE pr."role_id" = r."id" AND pr."name" = p.permission_name)
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE "attachments"`);
    await queryRunner.query(`DROP TABLE "comment_mentions"`);
    await queryRunner.query(`DROP TABLE "comments"`);
  }
}
