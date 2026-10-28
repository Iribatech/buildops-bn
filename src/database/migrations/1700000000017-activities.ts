import type { MigrationInterface, QueryRunner } from 'typeorm';

export class Activities1700000000017 implements MigrationInterface {
  name = 'Activities1700000000017';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE "activities" (
        "id" uuid NOT NULL DEFAULT gen_random_uuid(),
        "organization_id" uuid NOT NULL,
        "actor_id" uuid,
        "entity_type" character varying(32) NOT NULL,
        "entity_id" uuid NOT NULL,
        "action" character varying(32) NOT NULL,
        "title" character varying(255) NOT NULL,
        "body" text,
        "project_id" uuid,
        "task_id" uuid,
        "subtask_id" uuid,
        "diff" jsonb,
        "metadata" jsonb,
        "created_at" TIMESTAMP NOT NULL DEFAULT now(),
        CONSTRAINT "PK_activities" PRIMARY KEY ("id"),
        CONSTRAINT "FK_activities_organization"
          FOREIGN KEY ("organization_id")
          REFERENCES "organizations" ("id") ON DELETE CASCADE,
        CONSTRAINT "FK_activities_actor"
          FOREIGN KEY ("actor_id")
          REFERENCES "users" ("id") ON DELETE SET NULL,
        CONSTRAINT "FK_activities_project"
          FOREIGN KEY ("project_id")
          REFERENCES "projects" ("id") ON DELETE SET NULL,
        CONSTRAINT "FK_activities_task"
          FOREIGN KEY ("task_id")
          REFERENCES "tasks" ("id") ON DELETE SET NULL,
        CONSTRAINT "FK_activities_subtask"
          FOREIGN KEY ("subtask_id")
          REFERENCES "subtasks" ("id") ON DELETE SET NULL
      )
    `);

    await queryRunner.query(
      `CREATE INDEX "IDX_activities_org_created" ON "activities" ("organization_id", "created_at")`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_activities_entity" ON "activities" ("entity_type", "entity_id", "created_at")`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_activities_project_created" ON "activities" ("project_id", "created_at")`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_activities_task_created" ON "activities" ("task_id", "created_at")`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX "IDX_activities_task_created"`);
    await queryRunner.query(`DROP INDEX "IDX_activities_project_created"`);
    await queryRunner.query(`DROP INDEX "IDX_activities_entity"`);
    await queryRunner.query(`DROP INDEX "IDX_activities_org_created"`);
    await queryRunner.query(`DROP TABLE "activities"`);
  }
}
