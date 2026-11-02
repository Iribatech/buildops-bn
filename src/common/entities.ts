import { User } from '../user/user.entity.js';
import { Plan } from '../plan/plan.entity.js';
import { Subscription } from '../subscription/subscription.entity.js';
import { Organization } from '../organization/organization.entity.js';
import { Role } from '../role/role.entity.js';
import { Permission } from '../role/permission.entity.js';
import { OrganizationInvitation } from '../invitation/invitation.entity.js';
import { Badge } from '../badge/badge.entity.js';
import { Team } from '../team/team.entity.js';
import { TeamMember } from '../team/team-member.entity.js';
import { Department } from '../department/department.entity.js';
import { HumanResource } from '../human-resource/human-resource.entity.js';
import { Employee } from '../employee/employee.entity.js';
import { LeaveType } from '../leave/leave-type.entity.js';
import { LeaveRequest } from '../leave/leave-request.entity.js';
import { PerformanceReview } from '../performance-review/performance-review.entity.js';
import { Client } from '../client/client.entity.js';
import { Project } from '../project/project.entity.js';
import { Task } from '../task/task.entity.js';
import { Subtask } from '../subtask/subtask.entity.js';
import { Milestone } from '../milestone/milestone.entity.js';
import { Notification } from '../notification/notification.entity.js';
import { NotificationEmail } from '../notification/notification-email.entity.js';
import { TimeEntry } from '../time-entry/time-entry.entity.js';
import { TimeComplexity } from '../time-complexity/time-complexity.entity.js';
import { RefreshToken } from '../auth/refresh-token.entity.js';
import { UserSettings } from '../settings/user-settings.entity.js';
import { Activity } from '../activity/activity.entity.js';
import { Comment, CommentMention } from '../comment/comment.entity.js';
import { Attachment } from '../attachment/attachment.entity.js';
import { OrganizationSettings } from '../settings/organization-settings.entity.js';

/** Every entity mapped by the ORM; the single source of truth for TypeORM. */
export const ENTITIES = [
  User,
  Plan,
  Subscription,
  Organization,
  Role,
  Permission,
  OrganizationInvitation,
  Badge,
  Team,
  TeamMember,
  Department,
  HumanResource,
  Employee,
  LeaveType,
  LeaveRequest,
  PerformanceReview,
  Client,
  Project,
  Task,
  Subtask,
  Milestone,
  Notification,
  NotificationEmail,
  TimeEntry,
  TimeComplexity,
  RefreshToken,
  UserSettings,
  OrganizationSettings,
  Activity,
  Comment,
  CommentMention,
  Attachment,
];
