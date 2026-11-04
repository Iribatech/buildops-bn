import { Controller, Get, Request } from '@nestjs/common';
import { ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
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
} from '../common/decorators/protected.decorator.js';
import type { AuthenticatedRequest } from '../common/types.js';
import { WorkspaceResponseDto } from './dto/workspace.dto.js';
import { WorkspaceService } from './workspace.service.js';

/**
 * The authenticated application shell.
 *
 * One route rather than six, because the six things it returns are only useful
 * together: a client that has to call profile, organizations, membership,
 * subscription, notifications and assignments before it can draw the frame
 * spends its first screen waiting on the slowest of them, and every new screen
 * repeats the same orchestration.
 *
 * It is readable by every member of the organization, including one whose role
 * grants nothing: the response describes the caller, not the organization.
 */
@ApiRateLimited()
@ApiTags('workspace')
@Protected()
@Controller('workspace')
export class WorkspaceController {
  constructor(private readonly workspace: WorkspaceService) {}

  @Get()
  @OrganizationHeader()
  @ApiOperation({
    summary: 'Bootstrap the authenticated workspace',
    description:
      'Everything needed to render the application shell in one call: the ' +
      'signed-in user, the organizations they can switch to, the active ' +
      'organization, the caller’s role and permissions in it, the ' +
      'subscription with usage, the unread notification count and the work ' +
      'assigned to the caller. The individual routes remain authoritative; ' +
      'this is the connected view of them.',
  })
  @ApiResponse({
    description: 'The workspace context of the authenticated caller',
    status: 200,
    type: WorkspaceResponseDto,
  })
  @ApiErrors(403)
  async get(
    @OrgAuth() auth: OrganizationAuthContext,
    @Request() req: AuthenticatedRequest,
  ): Promise<WorkspaceResponseDto> {
    return this.workspace.bootstrap(auth, req.user);
  }
}
