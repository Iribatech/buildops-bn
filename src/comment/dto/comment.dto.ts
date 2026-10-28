import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsNotEmpty, IsOptional, IsString, IsUUID } from 'class-validator';

export class CreateCommentDto {
  @ApiProperty({ example: 'Great work, let us adjust the colors.' })
  @IsString()
  @IsNotEmpty()
  content: string;

  @ApiPropertyOptional({ example: 'd1e2f3a4-5b6c-4d7e-8f90-a1b2c3d4e5f6' })
  @IsOptional()
  @IsUUID()
  taskId?: string;

  @ApiPropertyOptional({ example: 'b6f0e2a1-9f2a-4a6f-8f1e-2c9a5b7d1e33' })
  @IsOptional()
  @IsUUID()
  subtaskId?: string;
}

export class UpdateCommentDto {
  @ApiProperty({ example: 'Updated comment text.' })
  @IsString()
  @IsNotEmpty()
  content: string;
}

export class CommentResponseDto {
  @ApiProperty()
  id: string;

  @ApiPropertyOptional()
  projectId: string | null;

  @ApiPropertyOptional()
  taskId: string | null;

  @ApiPropertyOptional()
  subtaskId: string | null;

  @ApiProperty()
  author: any;

  @ApiProperty()
  authorId: string;

  @ApiProperty()
  content: string;

  @ApiPropertyOptional()
  editedAt: Date | null;

  @ApiProperty({ type: () => Object, isArray: true })
  attachments: any[];

  @ApiProperty()
  createdAt: Date;

  @ApiProperty()
  updatedAt: Date;
}
