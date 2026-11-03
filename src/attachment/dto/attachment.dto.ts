import { ApiProperty } from '@nestjs/swagger';

export class AttachmentResponseDto {
  @ApiProperty()
  id: string;

  @ApiProperty()
  originalName: string;

  @ApiProperty()
  mimeType: string;

  @ApiProperty()
  size: number;

  @ApiProperty()
  kind: string;

  @ApiProperty({ required: false })
  taskId: string | null;

  @ApiProperty({ required: false })
  subtaskId: string | null;

  @ApiProperty({ required: false })
  commentId: string | null;

  @ApiProperty()
  uploaderId: string;

  @ApiProperty()
  createdAt: Date;

  @ApiProperty()
  url: string;
}
