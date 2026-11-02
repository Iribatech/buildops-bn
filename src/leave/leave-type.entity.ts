import {
  Check,
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import { Organization } from '../organization/organization.entity.js';
import { LEAVE_TYPE_STATUSES } from '../common/enums.js';

const inList = (values: readonly string[]): string =>
  values.map((value) => `'${value}'`).join(', ');

/**
 * A kind of absence the organization recognises (annual, sick, parental, ...).
 *
 * Leave types use an active/inactive lifecycle rather than deletion: an
 * inactive type disappears from new requests but approved history still names
 * it. `defaultEntitlementDays` is the annual allowance for every employee; it
 * is a default rather than a per-person balance so the first version of the
 * feature has one place to change the rule.
 */
@Entity('leave_types')
@Index('IDX_leave_types_org_name', ['organizationId', 'name'])
@Index('UQ_leave_types_org_name', ['organizationId', 'name'], { unique: true })
@Check(
  `CHK_leave_types_status`,
  `"status" IN (${inList(LEAVE_TYPE_STATUSES)})`,
)
@Check(
  `CHK_leave_types_entitlement`,
  `"default_entitlement_days" BETWEEN 0 AND 366`,
)
export class LeaveType {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'organization_id', type: 'uuid' })
  organizationId: string;

  @ManyToOne(() => Organization, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'organization_id' })
  organization: Organization;

  @Column({ type: 'varchar', length: 255 })
  name: string;

  @Column({ type: 'text', nullable: true })
  description: string | null;

  @Column({
    name: 'default_entitlement_days',
    type: 'integer',
    default: 0,
  })
  defaultEntitlementDays: number;

  @Column({ type: 'boolean', default: true })
  paid: boolean;

  @Column({ type: 'varchar', length: 50, default: 'active' })
  status: string;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;

  toResponse() {
    return {
      id: this.id,
      organizationId: this.organizationId,
      name: this.name,
      description: this.description,
      defaultEntitlementDays: this.defaultEntitlementDays,
      paid: this.paid,
      status: this.status,
      createdAt: this.createdAt,
      updatedAt: this.updatedAt,
    };
  }
}
