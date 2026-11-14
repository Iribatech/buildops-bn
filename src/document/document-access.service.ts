import { ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import type { SelectQueryBuilder, Repository } from 'typeorm';
import { PERMISSIONS, type PermissionName } from '../common/permissions.js';
import { Document } from './document.entity.js';

/** The caller fields the document rules need. */
export interface DocumentViewer {
  userId: string;
  permissions: PermissionName[];
}

/**
 * Read and write rules that are narrower than the route permissions.
 *
 * `document.view` says a member may read documentation; it does not say every
 * document is theirs to read. A project-restricted document is only visible to
 * its author, its reviewers, and the members of the teams working on that
 * project. Managers with `document.approve` see everything in the
 * organization, because reviewing is their job.
 *
 * The same rules are used by the attachment module, so a file attached to a
 * restricted document cannot be fetched around the document's visibility.
 */
@Injectable()
export class DocumentAccessService {
  constructor(
    @InjectRepository(Document)
    private readonly documentRepo: Repository<Document>,
  ) {}

  seesEveryDocument(viewer: DocumentViewer): boolean {
    return viewer.permissions.includes(PERMISSIONS.DOCUMENT_APPROVE);
  }

  /**
   * Adds the visibility predicate to a query whose root alias is a document.
   *
   * The predicate is raw SQL because it spans `tasks` and `team_members`,
   * which are not relations of the document. Aliases are prefixed so the
   * subquery cannot collide with the caller's joins.
   */
  applyVisibility(
    builder: SelectQueryBuilder<Document>,
    alias: string,
    viewer: DocumentViewer,
  ): void {
    if (this.seesEveryDocument(viewer)) return;

    builder.andWhere(
      `(
        ${alias}.visibility = 'organization'
        OR ${alias}.author_id = :documentViewerId
        OR (
          ${alias}.project_id IS NOT NULL
          AND EXISTS (
            SELECT 1
            FROM tasks document_visibility_task
            JOIN team_members document_visibility_member
              ON document_visibility_member.team_id = document_visibility_task.team_id
            WHERE document_visibility_task.project_id = ${alias}.project_id
              AND document_visibility_task.deleted_at IS NULL
              AND document_visibility_member.user_id = :documentViewerId
              AND document_visibility_member.status = 'active'
          )
        )
      )`,
      { documentViewerId: viewer.userId },
    );
  }

  async findVisible(
    organizationId: string,
    documentId: string,
    viewer: DocumentViewer,
    options: { withDeleted?: boolean } = {},
  ): Promise<Document> {
    const builder = this.documentRepo
      .createQueryBuilder('document')
      .leftJoinAndSelect('document.author', 'author')
      .leftJoinAndSelect('document.reviewedBy', 'reviewer')
      .where('document.organization_id = :organizationId', { organizationId })
      .andWhere('document.id = :documentId', { documentId });

    this.applyVisibility(builder, 'document', viewer);

    if (options.withDeleted) {
      builder.withDeleted();
    }

    const document = await builder.getOne();

    if (!document) {
      throw new NotFoundException('Document not found in this organization');
    }

    return document;
  }

  /**
   * Editing is personal before it is administrative: the author owns the text,
   * and a reviewer may correct or reopen any document they can approve.
   */
  assertCanEdit(document: Document, viewer: DocumentViewer): void {
    if (
      document.authorId !== viewer.userId &&
      !this.seesEveryDocument(viewer)
    ) {
      throw new ForbiddenException(
        'Only the author or a reviewer can change this document',
      );
    }
  }
}
