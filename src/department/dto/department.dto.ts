import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString, Length } from 'class-validator';
import { DEPARTMENT_STATUSES } from '../../common/enums.js';

export class CreateDepartmentDto {
  @ApiProperty({ example: 'Preconstruction' })
  @IsString()
  @Length(1, 255)
  name: string;

  @ApiPropertyOptional({
    example: 'Estimating, bid preparation, and preconstruction planning.',
  })
  @IsOptional()
  @IsString()
  description?: string;
}

export class UpdateDepartmentDto {
  @ApiPropertyOptional({ example: 'Preconstruction & Estimating' })
  @IsOptional()
  @IsString()
  @Length(1, 255)
  name?: string;

  @ApiPropertyOptional({
    example: 'Estimating, bid preparation, and preconstruction planning.',
  })
  @IsOptional()
  @IsString()
  description?: string;
}

export class DepartmentResponseDto {
  @ApiProperty({ example: '4c1f5c66-2f9e-4f5c-8b2a-9c0d1e2f3a4b' })
  id: string;

  @ApiProperty({ example: 'b7d8e9f0-1a2b-4c3d-8e4f-5a6b7c8d9e0f' })
  organizationId: string;

  @ApiProperty({ example: 'Preconstruction' })
  name: string;

  @ApiPropertyOptional({
    example: 'Estimating, bid preparation, and preconstruction planning.',
    nullable: true,
  })
  description: string | null;

  @ApiProperty({ enum: DEPARTMENT_STATUSES, example: 'active' })
  status: string;

  @ApiProperty({ example: '2026-09-30T10:00:00.000Z' })
  createdAt: Date;

  @ApiProperty({ example: '2026-09-30T10:00:00.000Z' })
  updatedAt: Date;
}
