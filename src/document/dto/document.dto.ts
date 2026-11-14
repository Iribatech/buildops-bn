import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsDateString,
  IsIn,
  IsNumber,
  IsOptional,
  IsString,
  IsUUID,
  Length,
  Max,
  MaxLength,
  Min,
} from 'class-validator';
import { PaginationQueryDto } from '../../common/pagination.dto.js';
import {
  DOCUMENT_STATUSES,
  DOCUMENT_TYPES,
  DOCUMENT_VISIBILITIES,
  type DocumentStatus,
  type DocumentType,
  type DocumentVisibility,
} from '../document.entity.js';

/** The user fields embedded in a document or version response. */
export class DocumentUserDto {
  @ApiProperty({ format: 'uuid' })
  id: string;

  @ApiPropertyOptional({ example: 'Aline Uwase' })
  name: string | null;

  @ApiProperty({ example: 'aline.uwase@example.com' })
  email: string;
}

export class CreateDocumentDto {
  @ApiProperty({ example: 'Foundation pour — work report' })
  @IsString()
  @Length(1, 255)
  title: string;

  @ApiPropertyOptional({
    example: 'Poured 42 m³ of C25 concrete over the north footing.',
    description: 'Document body. May be added later; defaults to empty.',
  })
  @IsOptional()
  @IsString()
  body?: string;

  @ApiPropertyOptional({
    enum: DOCUMENT_TYPES,
    default: 'work_report',
    description: 'What kind of work documentation this is',
  })
  @IsOptional()
  @IsIn(DOCUMENT_TYPES)
  type?: DocumentType;

  @ApiPropertyOptional({
    format: 'uuid',
    description:
      'Project the document belongs to. Derived from the task when only a task is given.',
  })
  @IsOptional()
  @IsUUID()
  projectId?: string;

  @ApiPropertyOptional({
    format: 'uuid',
    description: 'Task the document records work against',
  })
  @IsOptional()
  @IsUUID()
  taskId?: string;

  @ApiPropertyOptional({
    enum: DOCUMENT_VISIBILITIES,
    default: 'organization',
    description:
      'Who may read it. `project` limits the document to the project teams, its author and reviewers.',
  })
  @IsOptional()
  @IsIn(DOCUMENT_VISIBILITIES)
  visibility?: DocumentVisibility;

  @ApiPropertyOptional({
    example: '2026-11-14',
    description: 'The day the work being documented happened (DATE)',
  })
  @IsOptional()
  @IsDateString()
  workDate?: string;

  @ApiPropertyOptional({
    example: 6.5,
    minimum: 0,
    maximum: 24,
    description: 'Hours spent on the documented work, if tracked',
  })
  @IsOptional()
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  @Max(24)
  hours?: number;
}

export class UpdateDocumentDto {
  @ApiPropertyOptional({ example: 'Foundation pour — final report' })
  @IsOptional()
  @IsString()
  @Length(1, 255)
  title?: string;

  @ApiPropertyOptional({
    example: 'Poured 42 m³ of C25 concrete over the north footing.',
  })
  @IsOptional()
  @IsString()
  body?: string;

  @ApiPropertyOptional({ enum: DOCUMENT_TYPES })
  @IsOptional()
  @IsIn(DOCUMENT_TYPES)
  type?: DocumentType;

  @ApiPropertyOptional({
    format: 'uuid',
    nullable: true,
    description: 'Move the document to another project, or detach it with null',
  })
  @IsOptional()
  @IsUUID()
  projectId?: string | null;

  @ApiPropertyOptional({
    format: 'uuid',
    nullable: true,
    description: 'Move the document to another task, or detach it with null',
  })
  @IsOptional()
  @IsUUID()
  taskId?: string | null;

  @ApiPropertyOptional({ enum: DOCUMENT_VISIBILITIES })
  @IsOptional()
  @IsIn(DOCUMENT_VISIBILITIES)
  visibility?: DocumentVisibility;

  @ApiPropertyOptional({
    example: '2026-11-14',
    nullable: true,
    description: 'Work date, or null to clear it',
  })
  @IsOptional()
  @IsDateString()
  workDate?: string | null;

  @ApiPropertyOptional({
    example: 6.5,
    minimum: 0,
    maximum: 24,
    nullable: true,
    description: 'Hours spent, or null to clear them',
  })
  @IsOptional()
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  @Max(24)
  hours?: number | null;

  @ApiPropertyOptional({
    example: 4,
    description:
      'The revision the client last read. A mismatch is refused with 409 rather than overwriting a newer edit.',
  })
  @IsOptional()
  @IsNumber()
  @Min(1)
  revision?: number;
}

export class DocumentQueryDto extends PaginationQueryDto {
  @ApiPropertyOptional({ format: 'uuid' })
  @IsOptional()
  @IsUUID()
  projectId?: string;

  @ApiPropertyOptional({ format: 'uuid' })
  @IsOptional()
  @IsUUID()
  taskId?: string;

  @ApiPropertyOptional({ enum: DOCUMENT_TYPES })
  @IsOptional()
  @IsIn(DOCUMENT_TYPES)
  type?: DocumentType;

  @ApiPropertyOptional({ enum: DOCUMENT_STATUSES })
  @IsOptional()
  @IsIn(DOCUMENT_STATUSES)
  status?: DocumentStatus;

  @ApiPropertyOptional({
    format: 'uuid',
    description: 'Only documents authored by this member',
  })
  @IsOptional()
  @IsUUID()
  authorId?: string;

  @ApiPropertyOptional({ enum: DOCUMENT_VISIBILITIES })
  @IsOptional()
  @IsIn(DOCUMENT_VISIBILITIES)
  visibility?: DocumentVisibility;

  @ApiPropertyOptional({
    example: '2026-11-01',
    description: 'Only work dated on or after this day',
  })
  @IsOptional()
  @IsDateString()
  workDateFrom?: string;

  @ApiPropertyOptional({
    example: '2026-11-30',
    description: 'Only work dated on or before this day',
  })
  @IsOptional()
  @IsDateString()
  workDateTo?: string;

  @ApiPropertyOptional({
    example: 'concrete',
    description: 'Case-insensitive search across title and body',
  })
  @IsOptional()
  @IsString()
  @MaxLength(255)
  q?: string;
}

export class DocumentResponseDto {
  @ApiProperty({ format: 'uuid' })
  id: string;

  @ApiProperty({ format: 'uuid' })
  organizationId: string;

  @ApiPropertyOptional({ format: 'uuid', nullable: true })
  projectId: string | null;

  @ApiPropertyOptional({ format: 'uuid', nullable: true })
  taskId: string | null;

  @ApiPropertyOptional({ format: 'uuid', nullable: true })
  authorId: string | null;

  @ApiPropertyOptional({ type: () => DocumentUserDto, nullable: true })
  author: DocumentUserDto | null;

  @ApiProperty({ enum: DOCUMENT_TYPES })
  type: DocumentType;

  @ApiProperty({ example: 'Foundation pour — work report' })
  title: string;

  @ApiProperty({ example: 'Poured 42 m³ of C25 concrete.' })
  body: string;

  @ApiProperty({ enum: DOCUMENT_STATUSES })
  status: DocumentStatus;

  @ApiProperty({ enum: DOCUMENT_VISIBILITIES })
  visibility: DocumentVisibility;

  @ApiProperty({ example: 3, description: 'Number of the current version' })
  currentVersion: number;

  @ApiProperty({
    example: 7,
    description:
      'Optimistic-lock revision. Send it back on update to avoid overwriting a newer edit.',
  })
  revision: number;

  @ApiPropertyOptional({ example: '2026-11-14', nullable: true })
  workDate: string | null;

  @ApiPropertyOptional({ example: 6.5, nullable: true })
  hours: number | null;

  @ApiPropertyOptional({ nullable: true })
  submittedAt: Date | null;

  @ApiPropertyOptional({ nullable: true })
  approvedAt: Date | null;

  @ApiPropertyOptional({ format: 'uuid', nullable: true })
  approvedById: string | null;

  @ApiPropertyOptional({ format: 'uuid', nullable: true })
  reviewedById: string | null;

  @ApiPropertyOptional({ nullable: true })
  reviewedAt: Date | null;

  @ApiPropertyOptional({
    nullable: true,
    description: 'Reviewer note from the latest approval or rejection',
  })
  reviewNote: string | null;

  @ApiPropertyOptional({ type: () => DocumentUserDto, nullable: true })
  reviewer: DocumentUserDto | null;

  @ApiProperty()
  createdAt: Date;

  @ApiProperty()
  updatedAt: Date;
}

export class ApproveDocumentDto {
  @ApiPropertyOptional({
    example: 'Checked against the site diary; approved.',
    maxLength: 2000,
  })
  @IsOptional()
  @IsString()
  @MaxLength(2000)
  note?: string;
}

export class RejectDocumentDto {
  @ApiProperty({
    example: 'The concrete volume does not match the delivery notes.',
    maxLength: 2000,
  })
  @IsString()
  @Length(1, 2000)
  note: string;
}

export class DocumentVersionSummaryDto {
  @ApiProperty({ format: 'uuid' })
  id: string;

  @ApiProperty({ format: 'uuid' })
  documentId: string;

  @ApiProperty({ example: 1 })
  version: number;

  @ApiProperty({ example: 'Foundation pour — work report' })
  title: string;

  @ApiPropertyOptional({ format: 'uuid', nullable: true })
  editedById: string | null;

  @ApiPropertyOptional({ type: () => DocumentUserDto, nullable: true })
  editedBy: DocumentUserDto | null;

  @ApiProperty()
  createdAt: Date;
}

export class DocumentVersionResponseDto extends DocumentVersionSummaryDto {
  @ApiProperty({ example: 'Poured 42 m³ of C25 concrete.' })
  body: string;
}

export class DocumentMessageResponseDto {
  @ApiProperty({ example: 'Document deleted' })
  message: string;
}
