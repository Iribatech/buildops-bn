import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Param,
  ParseIntPipe,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
} from '@nestjs/common';
import { ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { PaginatedSchema } from '../common/dto/paginated-response.dto.js';
import { PERMISSIONS } from '../common/permissions.js';
import {
  ApiErrors,
  ApiRateLimited,
} from '../common/decorators/api-errors.decorator.js';
import {
  OrgAuth,
  type OrganizationAuthContext,
} from '../common/decorators/org-auth.decorator.js';
import {
  OrganizationHeader,
  Protected,
  RequirePermissions,
} from '../common/decorators/protected.decorator.js';
import type { Paginated } from '../common/pagination.dto.js';
import { TrashEntryDto } from '../common/soft-delete.js';
import { DocumentService } from './document.service.js';
import {
  ApproveDocumentDto,
  CreateDocumentDto,
  DocumentMessageResponseDto,
  DocumentQueryDto,
  DocumentResponseDto,
  DocumentVersionResponseDto,
  DocumentVersionSummaryDto,
  RejectDocumentDto,
  UpdateDocumentDto,
} from './dto/document.dto.js';

const DocumentPageDto = PaginatedSchema(DocumentResponseDto, 'DocumentPage');

/**
 * Work documentation inside an organization.
 *
 * A document records work that was done — a project report, a daily log, a
 * procedure, meeting notes or a handover — and keeps its version history and
 * approval state. Documents belong to the active organization and may be
 * attached to a project and a task.
 */
@ApiRateLimited()
@ApiTags('documents')
@Protected()
@Controller('documents')
export class DocumentController {
  constructor(private readonly documentService: DocumentService) {}

  @Post()
  @OrganizationHeader()
  @RequirePermissions(PERMISSIONS.DOCUMENT_CREATE)
  @ApiOperation({
    summary: 'Create a document',
    description:
      'Starts a draft and writes version 1. A project or task, when given, must belong to the active organization; a task also supplies its project. `visibility` defaults to organization; `project` requires a project and limits reads to its teams. Optional `workDate` and `hours` record when and for how long the documented work happened.',
  })
  @ApiResponse({
    description: 'The document, as its first draft',
    status: 201,
    type: DocumentResponseDto,
  })
  @ApiErrors(400, 403, 404)
  async create(
    @OrgAuth() auth: OrganizationAuthContext,
    @Body() dto: CreateDocumentDto,
  ): Promise<DocumentResponseDto> {
    const document = await this.documentService.create(
      auth.organizationId,
      auth,
      dto,
    );

    return document.toResponse();
  }

  @Get()
  @OrganizationHeader()
  @RequirePermissions(PERMISSIONS.DOCUMENT_VIEW)
  @ApiOperation({
    summary: 'List documents',
    description:
      'Paginated work documentation visible to the caller, newest activity first. Filter by project, task, type, status, author or visibility, restrict by `workDateFrom` / `workDateTo`, and search title and body with `q`.',
  })
  @ApiResponse({
    description: 'One page of documents',
    status: 200,
    type: DocumentPageDto,
  })
  @ApiErrors(403)
  async list(
    @OrgAuth() auth: OrganizationAuthContext,
    @Query() query: DocumentQueryDto,
  ): Promise<Paginated<DocumentResponseDto>> {
    const page = await this.documentService.list(
      auth.organizationId,
      query,
      auth,
    );

    return {
      ...page,
      items: page.items.map((document) => document.toResponse()),
    };
  }

  /**
   * Declared before `/documents/:documentId` so the literal route is reachable:
   * a parameterised route registered first would match `trash` and reject it as
   * a malformed UUID.
   */
  @Get('trash')
  @OrganizationHeader()
  @RequirePermissions(PERMISSIONS.DOCUMENT_VIEW)
  @ApiOperation({
    summary: 'List deleted documents',
    description:
      'Soft-deleted documents, with when each was deleted and who deleted it. These rows are excluded from every ordinary read.',
  })
  @ApiResponse({
    description: 'Documents moved to trash',
    status: 200,
    type: [TrashEntryDto],
  })
  @ApiErrors(403)
  async trash(
    @OrgAuth() auth: OrganizationAuthContext,
  ): Promise<TrashEntryDto[]> {
    return this.documentService.listDeleted(auth.organizationId, auth);
  }

  @Post(':documentId/restore')
  @OrganizationHeader()
  @RequirePermissions(PERMISSIONS.DOCUMENT_UPDATE)
  @ApiOperation({
    summary: 'Restore a deleted document',
    description:
      'Brings a soft-deleted document back with its version history intact.',
  })
  @ApiResponse({
    description: 'The document, no longer in the trash',
    status: 201,
    type: DocumentResponseDto,
  })
  @ApiErrors(403, 404, 409)
  async restore(
    @OrgAuth() auth: OrganizationAuthContext,
    @Param('documentId', ParseUUIDPipe) documentId: string,
  ): Promise<DocumentResponseDto> {
    const document = await this.documentService.restore(
      auth.organizationId,
      auth,
      documentId,
    );

    return document.toResponse();
  }

  @Get(':documentId')
  @OrganizationHeader()
  @RequirePermissions(PERMISSIONS.DOCUMENT_VIEW)
  @ApiOperation({
    summary: 'Get a document',
    description:
      'One document of the active organization, including its current text and approval state.',
  })
  @ApiResponse({
    description: 'The document',
    status: 200,
    type: DocumentResponseDto,
  })
  @ApiErrors(403, 404)
  async findOne(
    @OrgAuth() auth: OrganizationAuthContext,
    @Param('documentId', ParseUUIDPipe) documentId: string,
  ): Promise<DocumentResponseDto> {
    const document = await this.documentService.findOne(
      auth.organizationId,
      documentId,
      auth,
    );

    return document.toResponse();
  }

  @Patch(':documentId')
  @OrganizationHeader()
  @RequirePermissions(PERMISSIONS.DOCUMENT_UPDATE)
  @ApiOperation({
    summary: 'Update a document',
    description:
      'Edits the title, body, type, scope, visibility, work date or hours. Changing the title or body writes a new version; on a submitted or approved document it also returns the document to draft and clears the review stamps. A document with requested changes keeps that status and the reviewer note while the author addresses it. Send the last-seen `revision` to refuse a stale write with 409.',
  })
  @ApiResponse({
    description: 'The document as updated',
    status: 200,
    type: DocumentResponseDto,
  })
  @ApiErrors(400, 403, 404, 409)
  async update(
    @OrgAuth() auth: OrganizationAuthContext,
    @Param('documentId', ParseUUIDPipe) documentId: string,
    @Body() dto: UpdateDocumentDto,
  ): Promise<DocumentResponseDto> {
    const document = await this.documentService.update(
      auth.organizationId,
      auth,
      documentId,
      dto,
    );

    return document.toResponse();
  }

  @Delete(':documentId')
  @HttpCode(200)
  @OrganizationHeader()
  @RequirePermissions(PERMISSIONS.DOCUMENT_DELETE)
  @ApiOperation({
    summary: 'Delete a document',
    description:
      'Soft-deletes the document. Its version history stays intact and the document can be restored from the trash.',
  })
  @ApiResponse({
    description: 'Document moved to trash',
    status: 200,
    type: DocumentMessageResponseDto,
  })
  @ApiErrors(403, 404)
  async remove(
    @OrgAuth() auth: OrganizationAuthContext,
    @Param('documentId', ParseUUIDPipe) documentId: string,
  ): Promise<DocumentMessageResponseDto> {
    await this.documentService.remove(
      auth.organizationId,
      auth,
      documentId,
    );

    return { message: 'Document deleted' };
  }

  @Post(':documentId/submit')
  @HttpCode(200)
  @OrganizationHeader()
  @RequirePermissions(PERMISSIONS.DOCUMENT_UPDATE)
  @ApiOperation({
    summary: 'Submit a document for review',
    description:
      'Moves a draft to submitted. Refused with 409 when the document is not a draft, and with 400 when it has no content.',
  })
  @ApiResponse({
    description: 'The submitted document',
    status: 200,
    type: DocumentResponseDto,
  })
  @ApiErrors(400, 403, 404, 409)
  async submit(
    @OrgAuth() auth: OrganizationAuthContext,
    @Param('documentId', ParseUUIDPipe) documentId: string,
  ): Promise<DocumentResponseDto> {
    const document = await this.documentService.submit(
      auth.organizationId,
      auth,
      documentId,
    );

    return document.toResponse();
  }

  @Post(':documentId/approve')
  @HttpCode(200)
  @OrganizationHeader()
  @RequirePermissions(PERMISSIONS.DOCUMENT_APPROVE)
  @ApiOperation({
    summary: 'Approve a submitted document',
    description:
      'Moves a submitted document to approved and records the caller as the approver. Refused with 409 when the document is not submitted.',
  })
  @ApiResponse({
    description: 'The approved document',
    status: 200,
    type: DocumentResponseDto,
  })
  @ApiErrors(403, 404, 409)
  async approve(
    @OrgAuth() auth: OrganizationAuthContext,
    @Param('documentId', ParseUUIDPipe) documentId: string,
    @Body() dto?: ApproveDocumentDto,
  ): Promise<DocumentResponseDto> {
    const document = await this.documentService.approve(
      auth.organizationId,
      auth,
      documentId,
      dto?.note,
    );

    return document.toResponse();
  }

  @Post(':documentId/reject')
  @HttpCode(200)
  @OrganizationHeader()
  @RequirePermissions(PERMISSIONS.DOCUMENT_APPROVE)
  @ApiOperation({
    summary: 'Send a submitted document back for changes',
    description:
      'Moves a submitted document to changes_requested and records the reviewer note. Refused with 409 when the document is not submitted.',
  })
  @ApiResponse({
    description: 'The document, back with its author',
    status: 200,
    type: DocumentResponseDto,
  })
  @ApiErrors(400, 403, 404, 409)
  async reject(
    @OrgAuth() auth: OrganizationAuthContext,
    @Param('documentId', ParseUUIDPipe) documentId: string,
    @Body() dto: RejectDocumentDto,
  ): Promise<DocumentResponseDto> {
    const document = await this.documentService.reject(
      auth.organizationId,
      auth,
      documentId,
      dto.note,
    );

    return document.toResponse();
  }

  @Post(':documentId/archive')
  @HttpCode(200)
  @OrganizationHeader()
  @RequirePermissions(PERMISSIONS.DOCUMENT_UPDATE)
  @ApiOperation({
    summary: 'Archive a document',
    description:
      'Moves any live document to archived. The record stays readable and its history is kept; an already archived document is refused with 409.',
  })
  @ApiResponse({
    description: 'The archived document',
    status: 200,
    type: DocumentResponseDto,
  })
  @ApiErrors(403, 404, 409)
  async archive(
    @OrgAuth() auth: OrganizationAuthContext,
    @Param('documentId', ParseUUIDPipe) documentId: string,
  ): Promise<DocumentResponseDto> {
    const document = await this.documentService.archive(
      auth.organizationId,
      auth,
      documentId,
    );

    return document.toResponse();
  }

  @Get(':documentId/versions')
  @OrganizationHeader()
  @RequirePermissions(PERMISSIONS.DOCUMENT_VIEW)
  @ApiOperation({
    summary: 'List document versions',
    description:
      'Every saved version of the document, newest first, without the body text. Use the single-version route to read the text of one.',
  })
  @ApiResponse({
    description: 'The version history',
    status: 200,
    type: [DocumentVersionSummaryDto],
  })
  @ApiErrors(403, 404)
  async versions(
    @OrgAuth() auth: OrganizationAuthContext,
    @Param('documentId', ParseUUIDPipe) documentId: string,
  ): Promise<DocumentVersionSummaryDto[]> {
    const versions = await this.documentService.listVersions(
      auth.organizationId,
      documentId,
      auth,
    );

    return versions.map((version) => version.toSummary());
  }

  @Get(':documentId/versions/:version')
  @OrganizationHeader()
  @RequirePermissions(PERMISSIONS.DOCUMENT_VIEW)
  @ApiOperation({
    summary: 'Get one document version',
    description:
      'One saved snapshot, including the exact title and body that version held.',
  })
  @ApiResponse({
    description: 'The version',
    status: 200,
    type: DocumentVersionResponseDto,
  })
  @ApiErrors(403, 404)
  async version(
    @OrgAuth() auth: OrganizationAuthContext,
    @Param('documentId', ParseUUIDPipe) documentId: string,
    @Param('version', ParseIntPipe) version: number,
  ): Promise<DocumentVersionResponseDto> {
    const snapshot = await this.documentService.findVersion(
      auth.organizationId,
      documentId,
      version,
      auth,
    );

    return snapshot.toResponse();
  }
}
