import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsDateString,
  IsEmail,
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
import {
  EMPLOYEE_STATUSES,
  EMPLOYMENT_TYPES,
} from '../../common/enums.js';
import { PaginationQueryDto } from '../../common/pagination.dto.js';

export class CreateEmployeeDto {
  @ApiPropertyOptional({
    example: 'EMP-0142',
    description: 'Organization-unique employee number',
  })
  @IsOptional()
  @IsString()
  @MaxLength(50)
  employeeNumber?: string;

  @ApiProperty({ example: 'Jordan Ellis' })
  @IsString()
  @Length(1, 255)
  name: string;

  @ApiPropertyOptional({
    example: 'jordan.ellis@ridgelineconstruction.com',
    description: 'Work email address',
  })
  @IsOptional()
  @IsEmail()
  @MaxLength(255)
  email?: string;

  @ApiPropertyOptional({ example: 'jordan.ellis@example.com' })
  @IsOptional()
  @IsEmail()
  @MaxLength(255)
  personalEmail?: string;

  @ApiPropertyOptional({ example: '+1 503 555 0142' })
  @IsOptional()
  @IsString()
  @MaxLength(50)
  phone?: string;

  @ApiPropertyOptional({
    example: '2f7c1d4e-8a9b-4c3d-9e0f-1a2b3c4d5e6f',
    description: 'Login account for this person, when one exists',
  })
  @IsOptional()
  @IsUUID()
  userId?: string;

  @ApiPropertyOptional({
    example: '4c1f5c66-2f9e-4f5c-8b2a-9c0d1e2f3a4b',
    description: 'Department of the same organization',
  })
  @IsOptional()
  @IsUUID()
  departmentId?: string;

  @ApiPropertyOptional({
    example: 'b6f0e2a1-9f2a-4a6f-8f1e-2c9a5b7d1e33',
    description: 'The employee this person reports to',
  })
  @IsOptional()
  @IsUUID()
  managerId?: string;

  @ApiPropertyOptional({ example: 'HR Lead' })
  @IsOptional()
  @IsString()
  @MaxLength(255)
  jobTitle?: string;

  @ApiPropertyOptional({
    enum: EMPLOYMENT_TYPES,
    default: 'full_time',
  })
  @IsOptional()
  @IsIn(EMPLOYMENT_TYPES)
  employmentType?: string;

  @ApiPropertyOptional({ example: '2026-11-02' })
  @IsOptional()
  @IsDateString()
  hireDate?: string;

  @ApiPropertyOptional({ example: '1990-04-18' })
  @IsOptional()
  @IsDateString()
  dateOfBirth?: string;

  @ApiPropertyOptional({ example: '1420 NW Marshall St, Portland, OR' })
  @IsOptional()
  @IsString()
  address?: string;

  @ApiPropertyOptional({ example: 'Casey Ellis' })
  @IsOptional()
  @IsString()
  @MaxLength(255)
  emergencyContactName?: string;

  @ApiPropertyOptional({ example: '+1 503 555 0199' })
  @IsOptional()
  @IsString()
  @MaxLength(50)
  emergencyContactPhone?: string;

  @ApiPropertyOptional({ example: 'Spouse' })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  emergencyContactRelationship?: string;

  @ApiPropertyOptional({
    example: 95000,
    description: 'Annual salary in the organization currency, DECIMAL(12,2)',
  })
  @IsOptional()
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  @Max(9999999999.99)
  annualSalary?: number;

  @ApiPropertyOptional({ example: 'Field HR lead for the west region.' })
  @IsOptional()
  @IsString()
  notes?: string;
}

export class UpdateEmployeeDto {
  @ApiPropertyOptional({ example: 'EMP-0142', nullable: true })
  @IsOptional()
  @IsString()
  @MaxLength(50)
  employeeNumber?: string | null;

  @ApiPropertyOptional({ example: 'Jordan Ellis' })
  @IsOptional()
  @IsString()
  @Length(1, 255)
  name?: string;

  @ApiPropertyOptional({
    example: 'jordan.ellis@ridgelineconstruction.com',
    nullable: true,
  })
  @IsOptional()
  @IsEmail()
  @MaxLength(255)
  email?: string | null;

  @ApiPropertyOptional({ example: 'jordan.ellis@example.com', nullable: true })
  @IsOptional()
  @IsEmail()
  @MaxLength(255)
  personalEmail?: string | null;

  @ApiPropertyOptional({ example: '+1 503 555 0142', nullable: true })
  @IsOptional()
  @IsString()
  @MaxLength(50)
  phone?: string | null;

  @ApiPropertyOptional({
    example: '2f7c1d4e-8a9b-4c3d-9e0f-1a2b3c4d5e6f',
    nullable: true,
    description: 'Null detaches the login account',
  })
  @IsOptional()
  @IsUUID()
  userId?: string | null;

  @ApiPropertyOptional({
    example: '4c1f5c66-2f9e-4f5c-8b2a-9c0d1e2f3a4b',
    nullable: true,
  })
  @IsOptional()
  @IsUUID()
  departmentId?: string | null;

  @ApiPropertyOptional({
    example: 'b6f0e2a1-9f2a-4a6f-8f1e-2c9a5b7d1e33',
    nullable: true,
  })
  @IsOptional()
  @IsUUID()
  managerId?: string | null;

  @ApiPropertyOptional({ example: 'HR Lead', nullable: true })
  @IsOptional()
  @IsString()
  @MaxLength(255)
  jobTitle?: string | null;

  @ApiPropertyOptional({ enum: EMPLOYMENT_TYPES })
  @IsOptional()
  @IsIn(EMPLOYMENT_TYPES)
  employmentType?: string;

  @ApiPropertyOptional({ example: '2026-11-02', nullable: true })
  @IsOptional()
  @IsDateString()
  hireDate?: string | null;

  @ApiPropertyOptional({ example: '1990-04-18', nullable: true })
  @IsOptional()
  @IsDateString()
  dateOfBirth?: string | null;

  @ApiPropertyOptional({ nullable: true })
  @IsOptional()
  @IsString()
  address?: string | null;

  @ApiPropertyOptional({ nullable: true })
  @IsOptional()
  @IsString()
  @MaxLength(255)
  emergencyContactName?: string | null;

  @ApiPropertyOptional({ nullable: true })
  @IsOptional()
  @IsString()
  @MaxLength(50)
  emergencyContactPhone?: string | null;

  @ApiPropertyOptional({ nullable: true })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  emergencyContactRelationship?: string | null;

  @ApiPropertyOptional({ example: 95000, nullable: true })
  @IsOptional()
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  @Max(9999999999.99)
  annualSalary?: number | null;

  @ApiPropertyOptional({ nullable: true })
  @IsOptional()
  @IsString()
  notes?: string | null;
}

export class UpdateEmployeeStatusDto {
  @ApiProperty({
    enum: EMPLOYEE_STATUSES,
    example: 'terminated',
    description:
      'Lifecycle status. Terminating without a date uses today; any other status clears terminationDate.',
  })
  @IsIn(EMPLOYEE_STATUSES)
  status: string;

  @ApiPropertyOptional({ example: '2027-03-31' })
  @IsOptional()
  @IsDateString()
  terminationDate?: string;

  @ApiPropertyOptional({ example: 'Resigned for a role closer to home.' })
  @IsOptional()
  @IsString()
  notes?: string;
}

export class EmployeeResponseDto {
  @ApiProperty({ example: 'f6b7c8d9-0a1b-4c2d-8e3f-4a5b6c7d8e9f' })
  id: string;

  @ApiProperty({ example: '9a2b7c1d-4e5f-4a6b-8c9d-0e1f2a3b4c5d' })
  organizationId: string;

  @ApiPropertyOptional({
    example: '2f7c1d4e-8a9b-4c3d-9e0f-1a2b3c4d5e6f',
    nullable: true,
  })
  userId: string | null;

  @ApiPropertyOptional({ example: 'EMP-0142', nullable: true })
  employeeNumber: string | null;

  @ApiProperty({ example: 'Jordan Ellis' })
  name: string;

  @ApiPropertyOptional({
    example: 'jordan.ellis@ridgelineconstruction.com',
    nullable: true,
  })
  email: string | null;

  @ApiPropertyOptional({ nullable: true })
  personalEmail: string | null;

  @ApiPropertyOptional({ example: '+1 503 555 0142', nullable: true })
  phone: string | null;

  @ApiPropertyOptional({ nullable: true })
  departmentId: string | null;

  @ApiPropertyOptional({ example: 'People Operations', nullable: true })
  departmentName: string | null;

  @ApiPropertyOptional({ nullable: true })
  managerId: string | null;

  @ApiPropertyOptional({ example: 'Maya Chen', nullable: true })
  managerName: string | null;

  @ApiPropertyOptional({ example: 'HR Lead', nullable: true })
  jobTitle: string | null;

  @ApiProperty({ enum: EMPLOYMENT_TYPES, example: 'full_time' })
  employmentType: string;

  @ApiProperty({ enum: EMPLOYEE_STATUSES, example: 'active' })
  status: string;

  @ApiPropertyOptional({ example: '2026-11-02', nullable: true })
  hireDate: Date | null;

  @ApiPropertyOptional({ example: '2027-03-31', nullable: true })
  terminationDate: Date | null;

  @ApiPropertyOptional({ example: '1990-04-18', nullable: true })
  dateOfBirth: Date | null;

  @ApiPropertyOptional({ nullable: true })
  address: string | null;

  @ApiPropertyOptional({ nullable: true })
  emergencyContactName: string | null;

  @ApiPropertyOptional({ nullable: true })
  emergencyContactPhone: string | null;

  @ApiPropertyOptional({ nullable: true })
  emergencyContactRelationship: string | null;

  @ApiPropertyOptional({
    example: '95000.00',
    nullable: true,
    description: 'DECIMAL(12,2) returned as a string to preserve precision',
  })
  annualSalary: string | null;

  @ApiPropertyOptional({ nullable: true })
  notes: string | null;

  @ApiProperty({ example: '2026-10-26T10:00:00.000Z' })
  createdAt: Date;

  @ApiProperty({ example: '2026-10-26T10:00:00.000Z' })
  updatedAt: Date;
}

export class EmployeeQueryDto extends PaginationQueryDto {
  @ApiPropertyOptional({ enum: EMPLOYEE_STATUSES })
  @IsOptional()
  @IsIn(EMPLOYEE_STATUSES)
  status?: string;

  @ApiPropertyOptional({ example: '4c1f5c66-2f9e-4f5c-8b2a-9c0d1e2f3a4b' })
  @IsOptional()
  @IsUUID()
  departmentId?: string;

  @ApiPropertyOptional({ example: 'b6f0e2a1-9f2a-4a6f-8f1e-2c9a5b7d1e33' })
  @IsOptional()
  @IsUUID()
  managerId?: string;

  @ApiPropertyOptional({ enum: EMPLOYMENT_TYPES })
  @IsOptional()
  @IsIn(EMPLOYMENT_TYPES)
  employmentType?: string;

  @ApiPropertyOptional({
    example: 'jordan',
    description: 'Case-insensitive match on name, email or employee number',
  })
  @IsOptional()
  @IsString()
  @MaxLength(255)
  search?: string;
}
