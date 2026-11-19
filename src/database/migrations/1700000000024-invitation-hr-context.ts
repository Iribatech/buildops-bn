import type { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * HR context on invitations.
 *
 * Adds two nullable FK columns to `organization_invitations`:
 *   - `department_id`  — the department the invitee is being hired into
 *   - `team_id`        — the team the invitee is being assigned to
 *
 * Both are informational at invite time: they travel in the invitation email
 * so the invitee knows what they are joining, and HR can use them to pre-fill
 * the employee record once the person accepts. Neither column gates acceptance
 * or grants access; they are SET NULL on the relevant row deletions so the
 * invitation history survives a department or team being removed.
 */
export class InvitationHrContext1700000000024 implements MigrationInterface {
  name = 'InvitationHrContext1700000000024';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "organization_invitations"
      ADD COLUMN "department_id" uuid
    `);
    await queryRunner.query(`
      ALTER TABLE "organization_invitations"
      ADD CONSTRAINT "FK_invitations_department"
      FOREIGN KEY ("department_id") REFERENCES "departments" ("id") ON DELETE SET NULL
    `);

    await queryRunner.query(`
      ALTER TABLE "organization_invitations"
      ADD COLUMN "team_id" uuid
    `);
    await queryRunner.query(`
      ALTER TABLE "organization_invitations"
      ADD CONSTRAINT "FK_invitations_team"
      FOREIGN KEY ("team_id") REFERENCES "teams" ("id") ON DELETE SET NULL
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "organization_invitations"
      DROP CONSTRAINT "FK_invitations_team"
    `);
    await queryRunner.query(`
      ALTER TABLE "organization_invitations"
      DROP COLUMN "team_id"
    `);

    await queryRunner.query(`
      ALTER TABLE "organization_invitations"
      DROP CONSTRAINT "FK_invitations_department"
    `);
    await queryRunner.query(`
      ALTER TABLE "organization_invitations"
      DROP COLUMN "department_id"
    `);
  }
}
