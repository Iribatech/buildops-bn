import type { MigrationInterface, QueryRunner } from 'typeorm';

export class HrManagement1700000000019 implements MigrationInterface {
  name = 'HrManagement1700000000019';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE "employees" (
        "id" uuid NOT NULL DEFAULT gen_random_uuid(),
        "organization_id" uuid NOT NULL,
        "user_id" uuid,
        "employee_number" character varying(50),
        "name" character varying(255) NOT NULL,
        "email" character varying(255),
        "personal_email" character varying(255),
        "phone" character varying(50),
        "department_id" uuid,
        "manager_id" uuid,
        "job_title" character varying(255),
        "employment_type" character varying(50) NOT NULL DEFAULT 'full_time',
        "status" character varying(50) NOT NULL DEFAULT 'active',
        "hire_date" date,
        "termination_date" date,
        "date_of_birth" date,
        "address" text,
        "emergency_contact_name" character varying(255),
        "emergency_contact_phone" character varying(50),
        "emergency_contact_relationship" character varying(100),
        "annual_salary" numeric(12,2),
        "notes" text,
        "created_at" TIMESTAMP NOT NULL DEFAULT now(),
        "updated_at" TIMESTAMP NOT NULL DEFAULT now(),
        CONSTRAINT "PK_employees" PRIMARY KEY ("id"),
        CONSTRAINT "FK_employees_organization"
          FOREIGN KEY ("organization_id")
          REFERENCES "organizations" ("id") ON DELETE CASCADE,
        CONSTRAINT "FK_employees_user"
          FOREIGN KEY ("user_id")
          REFERENCES "users" ("id") ON DELETE SET NULL,
        CONSTRAINT "FK_employees_department"
          FOREIGN KEY ("department_id")
          REFERENCES "departments" ("id") ON DELETE SET NULL,
        CONSTRAINT "FK_employees_manager"
          FOREIGN KEY ("manager_id")
          REFERENCES "employees" ("id") ON DELETE SET NULL,
        CONSTRAINT "CHK_employees_status"
          CHECK ("status" IN ('active', 'probation', 'on_leave', 'terminated')),
        CONSTRAINT "CHK_employees_employment_type"
          CHECK ("employment_type" IN ('full_time', 'part_time', 'contractor', 'intern', 'temporary')),
        CONSTRAINT "CHK_employees_salary"
          CHECK ("annual_salary" IS NULL OR "annual_salary" >= 0),
        CONSTRAINT "CHK_employees_dates"
          CHECK ("termination_date" IS NULL OR "hire_date" IS NULL OR "termination_date" >= "hire_date")
      )
    `);

    await queryRunner.query(`
      CREATE INDEX "IDX_employees_org_name"
      ON "employees" ("organization_id", "name")
    `);
    await queryRunner.query(`
      CREATE INDEX "IDX_employees_org_department"
      ON "employees" ("organization_id", "department_id")
    `);
    await queryRunner.query(`
      CREATE INDEX "IDX_employees_org_manager"
      ON "employees" ("organization_id", "manager_id")
    `);
    await queryRunner.query(`
      CREATE UNIQUE INDEX "UQ_employees_org_employee_number"
      ON "employees" ("organization_id", "employee_number")
    `);
    await queryRunner.query(`
      CREATE UNIQUE INDEX "UQ_employees_org_user"
      ON "employees" ("organization_id", "user_id")
    `);

    await queryRunner.query(`
      CREATE TABLE "leave_types" (
        "id" uuid NOT NULL DEFAULT gen_random_uuid(),
        "organization_id" uuid NOT NULL,
        "name" character varying(255) NOT NULL,
        "description" text,
        "default_entitlement_days" integer NOT NULL DEFAULT 0,
        "paid" boolean NOT NULL DEFAULT true,
        "status" character varying(50) NOT NULL DEFAULT 'active',
        "created_at" TIMESTAMP NOT NULL DEFAULT now(),
        "updated_at" TIMESTAMP NOT NULL DEFAULT now(),
        CONSTRAINT "PK_leave_types" PRIMARY KEY ("id"),
        CONSTRAINT "FK_leave_types_organization"
          FOREIGN KEY ("organization_id")
          REFERENCES "organizations" ("id") ON DELETE CASCADE,
        CONSTRAINT "CHK_leave_types_status"
          CHECK ("status" IN ('active', 'inactive')),
        CONSTRAINT "CHK_leave_types_entitlement"
          CHECK ("default_entitlement_days" BETWEEN 0 AND 366)
      )
    `);

    await queryRunner.query(`
      CREATE INDEX "IDX_leave_types_org_name"
      ON "leave_types" ("organization_id", "name")
    `);
    await queryRunner.query(`
      CREATE UNIQUE INDEX "UQ_leave_types_org_name"
      ON "leave_types" ("organization_id", "name")
    `);

    await queryRunner.query(`
      CREATE TABLE "leave_requests" (
        "id" uuid NOT NULL DEFAULT gen_random_uuid(),
        "organization_id" uuid NOT NULL,
        "employee_id" uuid NOT NULL,
        "leave_type_id" uuid NOT NULL,
        "start_date" date NOT NULL,
        "end_date" date NOT NULL,
        "days" integer NOT NULL,
        "reason" text,
        "status" character varying(50) NOT NULL DEFAULT 'pending',
        "approver_id" uuid,
        "decided_at" TIMESTAMP,
        "decision_note" text,
        "cancelled_at" TIMESTAMP,
        "created_at" TIMESTAMP NOT NULL DEFAULT now(),
        "updated_at" TIMESTAMP NOT NULL DEFAULT now(),
        CONSTRAINT "PK_leave_requests" PRIMARY KEY ("id"),
        CONSTRAINT "FK_leave_requests_organization"
          FOREIGN KEY ("organization_id")
          REFERENCES "organizations" ("id") ON DELETE CASCADE,
        CONSTRAINT "FK_leave_requests_employee"
          FOREIGN KEY ("employee_id")
          REFERENCES "employees" ("id") ON DELETE CASCADE,
        CONSTRAINT "FK_leave_requests_leave_type"
          FOREIGN KEY ("leave_type_id")
          REFERENCES "leave_types" ("id") ON DELETE RESTRICT,
        CONSTRAINT "FK_leave_requests_approver"
          FOREIGN KEY ("approver_id")
          REFERENCES "users" ("id") ON DELETE SET NULL,
        CONSTRAINT "CHK_leave_requests_status"
          CHECK ("status" IN ('pending', 'approved', 'rejected', 'cancelled')),
        CONSTRAINT "CHK_leave_requests_dates"
          CHECK ("end_date" >= "start_date"),
        CONSTRAINT "CHK_leave_requests_days"
          CHECK ("days" >= 1)
      )
    `);

    await queryRunner.query(`
      CREATE INDEX "IDX_leave_requests_org_employee_status"
      ON "leave_requests" ("organization_id", "employee_id", "status")
    `);
    await queryRunner.query(`
      CREATE INDEX "IDX_leave_requests_org_dates"
      ON "leave_requests" ("organization_id", "start_date", "end_date")
    `);

    await queryRunner.query(`
      CREATE TABLE "performance_reviews" (
        "id" uuid NOT NULL DEFAULT gen_random_uuid(),
        "organization_id" uuid NOT NULL,
        "employee_id" uuid NOT NULL,
        "reviewer_id" uuid NOT NULL,
        "period_start" date NOT NULL,
        "period_end" date NOT NULL,
        "review_date" date,
        "rating" integer,
        "status" character varying(50) NOT NULL DEFAULT 'draft',
        "summary" text,
        "strengths" text,
        "improvements" text,
        "goals" text,
        "submitted_at" TIMESTAMP,
        "acknowledged_at" TIMESTAMP,
        "created_at" TIMESTAMP NOT NULL DEFAULT now(),
        "updated_at" TIMESTAMP NOT NULL DEFAULT now(),
        CONSTRAINT "PK_performance_reviews" PRIMARY KEY ("id"),
        CONSTRAINT "FK_performance_reviews_organization"
          FOREIGN KEY ("organization_id")
          REFERENCES "organizations" ("id") ON DELETE CASCADE,
        CONSTRAINT "FK_performance_reviews_employee"
          FOREIGN KEY ("employee_id")
          REFERENCES "employees" ("id") ON DELETE CASCADE,
        CONSTRAINT "FK_performance_reviews_reviewer"
          FOREIGN KEY ("reviewer_id")
          REFERENCES "users" ("id") ON DELETE RESTRICT,
        CONSTRAINT "CHK_performance_reviews_status"
          CHECK ("status" IN ('draft', 'submitted', 'acknowledged')),
        CONSTRAINT "CHK_performance_reviews_period"
          CHECK ("period_end" >= "period_start"),
        CONSTRAINT "CHK_performance_reviews_rating"
          CHECK ("rating" IS NULL OR "rating" BETWEEN 1 AND 5)
      )
    `);

    await queryRunner.query(`
      CREATE INDEX "IDX_performance_reviews_org_employee"
      ON "performance_reviews" ("organization_id", "employee_id", "period_start")
    `);
    await queryRunner.query(`
      CREATE INDEX "IDX_performance_reviews_org_status"
      ON "performance_reviews" ("organization_id", "status")
    `);

    await queryRunner.query(`
      ALTER TABLE "project_human_resources"
      ADD COLUMN "employee_id" uuid
    `);
    await queryRunner.query(`
      ALTER TABLE "project_human_resources"
      ADD CONSTRAINT "FK_project_human_resources_employee"
      FOREIGN KEY ("employee_id")
      REFERENCES "employees" ("id") ON DELETE SET NULL
    `);
    await queryRunner.query(`
      CREATE INDEX "IDX_project_human_resources_org_employee"
      ON "project_human_resources" ("organization_id", "employee_id")
    `);

    await queryRunner.query(`
      WITH template_permissions(template_key, permission_name, permission_description) AS (
        VALUES
          ('owner', 'employee.view', 'view employee records'),
          ('owner', 'employee.create', 'create employee records'),
          ('owner', 'employee.update', 'update employee records'),
          ('owner', 'leave_type.view', 'view leave types'),
          ('owner', 'leave_type.create', 'create leave types'),
          ('owner', 'leave_type.update', 'update leave types'),
          ('owner', 'leave_request.view', 'view leave requests and balances'),
          ('owner', 'leave_request.create', 'request leave'),
          ('owner', 'leave_request.update', 'update leave requests'),
          ('owner', 'leave_request.approve', 'approve or reject leave requests'),
          ('owner', 'leave_request.cancel', 'cancel leave requests'),
          ('owner', 'performance_review.view', 'view performance reviews'),
          ('owner', 'performance_review.create', 'create performance reviews'),
          ('owner', 'performance_review.update', 'update performance reviews'),
          ('hr_manager', 'employee.view', 'view employee records'),
          ('hr_manager', 'employee.create', 'create employee records'),
          ('hr_manager', 'employee.update', 'update employee records'),
          ('hr_manager', 'leave_type.view', 'view leave types'),
          ('hr_manager', 'leave_type.create', 'create leave types'),
          ('hr_manager', 'leave_type.update', 'update leave types'),
          ('hr_manager', 'leave_request.view', 'view leave requests and balances'),
          ('hr_manager', 'leave_request.create', 'request leave'),
          ('hr_manager', 'leave_request.update', 'update leave requests'),
          ('hr_manager', 'leave_request.approve', 'approve or reject leave requests'),
          ('hr_manager', 'leave_request.cancel', 'cancel leave requests'),
          ('hr_manager', 'performance_review.view', 'view performance reviews'),
          ('hr_manager', 'performance_review.create', 'create performance reviews'),
          ('hr_manager', 'performance_review.update', 'update performance reviews')
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

    await queryRunner.query(`
      WITH default_leave_types(name, description, days, paid) AS (
        VALUES
          ('Annual Leave', 'Paid holiday entitlement carried through the year.', 20, true),
          ('Sick Leave', 'Paid time off for illness and recovery.', 10, true),
          ('Unpaid Leave', 'Approved absence without pay.', 0, false),
          ('Parental Leave', 'Leave around the birth or adoption of a child.', 90, true),
          ('Bereavement Leave', 'Paid leave following the loss of a family member.', 5, true)
      )
      INSERT INTO "leave_types"
        ("id", "organization_id", "name", "description", "default_entitlement_days", "paid", "status", "created_at", "updated_at")
      SELECT gen_random_uuid(), o."id", t.name, t.description, t.days, t.paid, 'active', now(), now()
      FROM "organizations" o
      CROSS JOIN default_leave_types t
      WHERE NOT EXISTS (
        SELECT 1 FROM "leave_types" lt
        WHERE lt."organization_id" = o."id" AND lt."name" = t.name
      )
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      DELETE FROM "permissions"
      WHERE "name" IN (
        'employee.view', 'employee.create', 'employee.update',
        'leave_type.view', 'leave_type.create', 'leave_type.update',
        'leave_request.view', 'leave_request.create', 'leave_request.update',
        'leave_request.approve', 'leave_request.cancel',
        'performance_review.view', 'performance_review.create',
        'performance_review.update'
      )
      AND "role_id" IN (
        SELECT "id" FROM "roles" WHERE "key" IN ('owner', 'hr_manager')
      )
    `);

    await queryRunner.query(`
      DROP INDEX "IDX_project_human_resources_org_employee"
    `);
    await queryRunner.query(`
      ALTER TABLE "project_human_resources"
      DROP CONSTRAINT "FK_project_human_resources_employee"
    `);
    await queryRunner.query(`
      ALTER TABLE "project_human_resources"
      DROP COLUMN "employee_id"
    `);

    await queryRunner.query(`
      DROP INDEX "IDX_performance_reviews_org_status"
    `);
    await queryRunner.query(`
      DROP INDEX "IDX_performance_reviews_org_employee"
    `);
    await queryRunner.query(`DROP TABLE "performance_reviews"`);

    await queryRunner.query(`
      DROP INDEX "IDX_leave_requests_org_dates"
    `);
    await queryRunner.query(`
      DROP INDEX "IDX_leave_requests_org_employee_status"
    `);
    await queryRunner.query(`DROP TABLE "leave_requests"`);

    await queryRunner.query(`DROP INDEX "UQ_leave_types_org_name"`);
    await queryRunner.query(`DROP INDEX "IDX_leave_types_org_name"`);
    await queryRunner.query(`DROP TABLE "leave_types"`);

    await queryRunner.query(`DROP INDEX "UQ_employees_org_user"`);
    await queryRunner.query(`DROP INDEX "UQ_employees_org_employee_number"`);
    await queryRunner.query(`DROP INDEX "IDX_employees_org_manager"`);
    await queryRunner.query(`DROP INDEX "IDX_employees_org_department"`);
    await queryRunner.query(`DROP INDEX "IDX_employees_org_name"`);
    await queryRunner.query(`DROP TABLE "employees"`);
  }
}
