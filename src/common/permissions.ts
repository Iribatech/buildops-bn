export const PERMISSIONS = {
  ORGANIZATION_VIEW: 'organization.view',
  ORGANIZATION_CREATE: 'organization.create',
  ORGANIZATION_UPDATE: 'organization.update',
  ORGANIZATION_DELETE: 'organization.delete',
  MEMBER_VIEW: 'member.view',
  MEMBER_INVITE: 'member.invite',
  MEMBER_UPDATE: 'member.update',
  MEMBER_REMOVE: 'member.remove',
  ROLE_VIEW: 'role.view',
  ROLE_CREATE: 'role.create',
  ROLE_UPDATE: 'role.update',
  ROLE_DELETE: 'role.delete',
  ROLE_ASSIGN: 'role.assign',
  PERMISSION_VIEW: 'permission.view',
  TEAM_VIEW: 'team.view',
  TEAM_CREATE: 'team.create',
  TEAM_UPDATE: 'team.update',
  TEAM_DELETE: 'team.delete',
  TEAM_MEMBER_ADD: 'team.member.add',
  TEAM_MEMBER_REMOVE: 'team.member.remove',
  DEPARTMENT_VIEW: 'department.view',
  DEPARTMENT_CREATE: 'department.create',
  DEPARTMENT_UPDATE: 'department.update',
  HUMAN_RESOURCE_VIEW: 'human_resource.view',
  HUMAN_RESOURCE_CREATE: 'human_resource.create',
  HUMAN_RESOURCE_UPDATE: 'human_resource.update',
  EMPLOYEE_VIEW: 'employee.view',
  EMPLOYEE_CREATE: 'employee.create',
  EMPLOYEE_UPDATE: 'employee.update',
  LEAVE_TYPE_VIEW: 'leave_type.view',
  LEAVE_TYPE_CREATE: 'leave_type.create',
  LEAVE_TYPE_UPDATE: 'leave_type.update',
  LEAVE_REQUEST_VIEW: 'leave_request.view',
  LEAVE_REQUEST_CREATE: 'leave_request.create',
  LEAVE_REQUEST_UPDATE: 'leave_request.update',
  LEAVE_REQUEST_APPROVE: 'leave_request.approve',
  LEAVE_REQUEST_CANCEL: 'leave_request.cancel',
  PERFORMANCE_REVIEW_VIEW: 'performance_review.view',
  PERFORMANCE_REVIEW_CREATE: 'performance_review.create',
  PERFORMANCE_REVIEW_UPDATE: 'performance_review.update',
  CLIENT_VIEW: 'client.view',
  CLIENT_CREATE: 'client.create',
  CLIENT_UPDATE: 'client.update',
  CLIENT_DELETE: 'client.delete',
  PROJECT_VIEW: 'project.view',
  PROJECT_CREATE: 'project.create',
  PROJECT_UPDATE: 'project.update',
  PROJECT_DELETE: 'project.delete',
  BADGE_VIEW: 'badge.view',
  BADGE_CREATE: 'badge.create',
  BADGE_UPDATE: 'badge.update',
  BADGE_DELETE: 'badge.delete',
  TASK_VIEW: 'task.view',
  TASK_CREATE: 'task.create',
  TASK_UPDATE: 'task.update',
  TASK_DELETE: 'task.delete',
  MILESTONE_VIEW: 'milestone.view',
  MILESTONE_CREATE: 'milestone.create',
  MILESTONE_UPDATE: 'milestone.update',
  MILESTONE_DELETE: 'milestone.delete',
  NOTIFICATION_VIEW: 'notification.view',
  NOTIFICATION_UPDATE: 'notification.update',
  NOTIFICATION_DELETE: 'notification.delete',
  SUBTASK_VIEW: 'subtask.view',
  SUBTASK_CREATE: 'subtask.create',
  SUBTASK_UPDATE: 'subtask.update',
  SUBTASK_DELETE: 'subtask.delete',
  SUBTASK_ASSIGN: 'subtask.assign',
  TIME_ENTRY_VIEW: 'time_entry.view',
  TIME_ENTRY_VIEW_ALL: 'time_entry.view_all',
  TIME_ENTRY_CREATE: 'time_entry.create',
  TIME_ENTRY_UPDATE: 'time_entry.update',
  TIME_ENTRY_DELETE: 'time_entry.delete',
  TIME_ENTRY_START_TIMER: 'time_entry.start_timer',
  TIME_ENTRY_STOP_TIMER: 'time_entry.stop_timer',
  TIME_COMPLEXITY_VIEW: 'time_complexity.view',
  TIME_COMPLEXITY_CREATE: 'time_complexity.create',
  TIME_COMPLEXITY_UPDATE: 'time_complexity.update',
  TIME_COMPLEXITY_DELETE: 'time_complexity.delete',
  DASHBOARD_VIEW: 'dashboard.view',
  SETTINGS_VIEW: 'settings.view',
  SETTINGS_UPDATE: 'settings.update',
  CHAT_VIEW: 'chat.view',
  CHAT_CREATE: 'chat.create',
  CHAT_MANAGE: 'chat.manage',
} as const;

export type PermissionName = (typeof PERMISSIONS)[keyof typeof PERMISSIONS];

export const ALL_PERMISSIONS: PermissionName[] = Object.values(PERMISSIONS);

const viewOnly = (resource: string): PermissionName[] => [
  `${resource}.view` as PermissionName,
];

export interface RoleTemplate {
  key: string;
  name: string;
  description: string;
  permissions: PermissionName[];
}

export const DEFAULT_ROLE_TEMPLATES: RoleTemplate[] = [
  {
    key: 'owner',
    name: 'Owner',
    description:
      'Subscription creator. Full access to every resource in the organization.',
    permissions: ALL_PERMISSIONS,
  },
  {
    key: 'project_manager',
    name: 'Project Manager',
    description:
      'Runs delivery: manages clients, projects, teams, tasks, subtasks and estimation.',
    permissions: [
      ...viewOnly('organization'),
      ...viewOnly('member'),
      ...viewOnly('role'),
      ...viewOnly('permission'),
      ...viewOnly('team'),
      'team.update' as PermissionName,
      'team.member.add' as PermissionName,
      'team.member.remove' as PermissionName,
      ...viewOnly('department'),
      PERMISSIONS.DEPARTMENT_CREATE,
      PERMISSIONS.DEPARTMENT_UPDATE,
      ...viewOnly('human_resource'),
      PERMISSIONS.HUMAN_RESOURCE_CREATE,
      PERMISSIONS.HUMAN_RESOURCE_UPDATE,
      'client.create' as PermissionName,
      'client.update' as PermissionName,
      'client.delete' as PermissionName,
      'project.create' as PermissionName,
      'project.update' as PermissionName,
      'project.delete' as PermissionName,
      'badge.create' as PermissionName,
      'badge.update' as PermissionName,
      'badge.delete' as PermissionName,
      'task.create' as PermissionName,
      'task.update' as PermissionName,
      'task.delete' as PermissionName,
      'milestone.view' as PermissionName,
      'milestone.create' as PermissionName,
      'milestone.update' as PermissionName,
      'milestone.delete' as PermissionName,
      'subtask.create' as PermissionName,
      'subtask.update' as PermissionName,
      'subtask.delete' as PermissionName,
      'subtask.assign' as PermissionName,
      PERMISSIONS.TIME_ENTRY_VIEW,
      PERMISSIONS.TIME_ENTRY_VIEW_ALL,
      PERMISSIONS.TIME_ENTRY_UPDATE,
      PERMISSIONS.TIME_ENTRY_DELETE,
      PERMISSIONS.TIME_ENTRY_START_TIMER,
      PERMISSIONS.TIME_ENTRY_STOP_TIMER,
      PERMISSIONS.TIME_COMPLEXITY_CREATE,
      PERMISSIONS.TIME_COMPLEXITY_UPDATE,
      PERMISSIONS.TIME_COMPLEXITY_DELETE,
      PERMISSIONS.DASHBOARD_VIEW,
      // Runs delivery, so it also owns milestones and the notification inbox;
      // `notification.update` and `notification.delete` only ever touch the
      // actor's own rows, so they are safe to share widely.
      PERMISSIONS.NOTIFICATION_VIEW,
      PERMISSIONS.NOTIFICATION_UPDATE,
      PERMISSIONS.NOTIFICATION_DELETE,
      // Runs delivery, so it owns the conventions the whole team works to.
      // `settings.update` changes what everyone in the organization sees, which
      // is why it is not handed to a developer or a tester.
      PERMISSIONS.SETTINGS_VIEW,
      PERMISSIONS.SETTINGS_UPDATE,
      PERMISSIONS.CHAT_VIEW,
      PERMISSIONS.CHAT_CREATE,
      PERMISSIONS.CHAT_MANAGE,
    ],
  },
  {
    key: 'hr_manager',
    name: 'HR Manager',
    description:
      'Runs the people function: employee records, departments, leave and performance reviews.',
    permissions: [
      ...viewOnly('organization'),
      ...viewOnly('member'),
      ...viewOnly('department'),
      PERMISSIONS.DEPARTMENT_CREATE,
      PERMISSIONS.DEPARTMENT_UPDATE,
      ...viewOnly('human_resource'),
      PERMISSIONS.HUMAN_RESOURCE_CREATE,
      PERMISSIONS.HUMAN_RESOURCE_UPDATE,
      PERMISSIONS.EMPLOYEE_VIEW,
      PERMISSIONS.EMPLOYEE_CREATE,
      PERMISSIONS.EMPLOYEE_UPDATE,
      PERMISSIONS.LEAVE_TYPE_VIEW,
      PERMISSIONS.LEAVE_TYPE_CREATE,
      PERMISSIONS.LEAVE_TYPE_UPDATE,
      PERMISSIONS.LEAVE_REQUEST_VIEW,
      PERMISSIONS.LEAVE_REQUEST_CREATE,
      PERMISSIONS.LEAVE_REQUEST_UPDATE,
      PERMISSIONS.LEAVE_REQUEST_APPROVE,
      PERMISSIONS.LEAVE_REQUEST_CANCEL,
      PERMISSIONS.PERFORMANCE_REVIEW_VIEW,
      PERMISSIONS.PERFORMANCE_REVIEW_CREATE,
      PERMISSIONS.PERFORMANCE_REVIEW_UPDATE,
      PERMISSIONS.DASHBOARD_VIEW,
      PERMISSIONS.SETTINGS_VIEW,
      PERMISSIONS.NOTIFICATION_VIEW,
      PERMISSIONS.NOTIFICATION_UPDATE,
      PERMISSIONS.NOTIFICATION_DELETE,
      PERMISSIONS.CHAT_VIEW,
      PERMISSIONS.CHAT_CREATE,
      PERMISSIONS.CHAT_MANAGE,
    ],
  },
  {
    key: 'developer',
    name: 'Developer',
    description:
      'Creates and updates development tasks, subtasks and their own time.',
    permissions: [
      ...viewOnly('team'),
      ...viewOnly('department'),
      ...viewOnly('client'),
      ...viewOnly('project'),
      ...viewOnly('badge'),
      ...viewOnly('time_complexity'),
      // Reading has to come before writing. `task.create` without `task.view`
      // described a role that could add work to a board it was then forbidden
      // to open, and `subtask.assign` without `subtask.view` one that could
      // hand work out while unable to see who had taken it.
      ...viewOnly('task'),
      ...viewOnly('subtask'),
      PERMISSIONS.TASK_CREATE,
      PERMISSIONS.TASK_UPDATE,
      PERMISSIONS.MILESTONE_VIEW,
      PERMISSIONS.SUBTASK_CREATE,
      PERMISSIONS.SUBTASK_UPDATE,
      PERMISSIONS.SUBTASK_ASSIGN,
      PERMISSIONS.TIME_ENTRY_VIEW,
      PERMISSIONS.TIME_ENTRY_CREATE,
      PERMISSIONS.TIME_ENTRY_START_TIMER,
      PERMISSIONS.TIME_ENTRY_STOP_TIMER,
      PERMISSIONS.DASHBOARD_VIEW,
      PERMISSIONS.SETTINGS_VIEW,
      // The inbox is personal: update and delete act only on the caller's own
      // notifications, so a developer may keep their own inbox tidy.
      PERMISSIONS.NOTIFICATION_VIEW,
      PERMISSIONS.NOTIFICATION_UPDATE,
      PERMISSIONS.NOTIFICATION_DELETE,
      PERMISSIONS.CHAT_VIEW,
      PERMISSIONS.CHAT_CREATE,
    ],
  },
  {
    key: 'tester',
    name: 'Tester',
    description: 'Reviews work, manages test subtasks and logs their own time.',
    permissions: [
      ...viewOnly('team'),
      ...viewOnly('department'),
      ...viewOnly('project'),
      ...viewOnly('badge'),
      ...viewOnly('time_complexity'),
      // The same reasoning as `developer`: a role that updates tasks and
      // subtasks has to be able to read the ones it is reviewing.
      ...viewOnly('task'),
      ...viewOnly('subtask'),
      PERMISSIONS.TASK_UPDATE,
      PERMISSIONS.MILESTONE_VIEW,
      PERMISSIONS.SUBTASK_CREATE,
      PERMISSIONS.SUBTASK_UPDATE,
      PERMISSIONS.TIME_ENTRY_VIEW,
      PERMISSIONS.TIME_ENTRY_CREATE,
      PERMISSIONS.TIME_ENTRY_START_TIMER,
      PERMISSIONS.TIME_ENTRY_STOP_TIMER,
      PERMISSIONS.DASHBOARD_VIEW,
      PERMISSIONS.SETTINGS_VIEW,
      // A reviewer still gets pinged about what they are asked to look at and can
      // manage their own inbox.
      PERMISSIONS.NOTIFICATION_VIEW,
      PERMISSIONS.NOTIFICATION_UPDATE,
      PERMISSIONS.NOTIFICATION_DELETE,
      PERMISSIONS.CHAT_VIEW,
      PERMISSIONS.CHAT_CREATE,
    ],
  },
  {
    key: 'viewer',
    name: 'Viewer',
    description: 'Read-only access to every resource of the organization.',
    permissions: [
      ...viewOnly('organization'),
      ...viewOnly('member'),
      ...viewOnly('role'),
      ...viewOnly('permission'),
      ...viewOnly('team'),
      ...viewOnly('department'),
      ...viewOnly('client'),
      ...viewOnly('project'),
      ...viewOnly('badge'),
      ...viewOnly('task'),
      ...viewOnly('subtask'),
      ...viewOnly('milestone'),
      ...viewOnly('notification'),
      ...viewOnly('time_entry'),
      ...viewOnly('time_complexity'),
      PERMISSIONS.DASHBOARD_VIEW,
      // View only, like every other resource here: a viewer can read what the
      // organization works to, but `settings.update` is what would change it
      // for everyone. `/settings/me` is not gated by this permission at all --
      // a user's own preferences belong to that user.
      PERMISSIONS.SETTINGS_VIEW,
      ...viewOnly('chat'),
    ],
  },
];

export function isPermissionName(value: string): value is PermissionName {
  return (ALL_PERMISSIONS as string[]).includes(value);
}

/**
 * Permissions that make a member part of the "what's new in the system"
 * broadcast audience.
 *
 * Managing a project or a milestone is the line between working on delivery and
 * running it, so a role holding any of these gets the task/subtask/milestone
 * lifecycle feed and nothing narrower does. Chosen by capability rather than by
 * template so the audience is dynamic: grant one of these to a custom role and
 * it joins the feed, revoke them and it leaves -- no code change, no fixed list
 * of role names or keys.
 */
export const BROADCAST_AUDIENCE_PERMISSIONS: PermissionName[] = [
  PERMISSIONS.PROJECT_CREATE,
  PERMISSIONS.PROJECT_UPDATE,
  PERMISSIONS.PROJECT_DELETE,
  PERMISSIONS.MILESTONE_CREATE,
  PERMISSIONS.MILESTONE_UPDATE,
  PERMISSIONS.MILESTONE_DELETE,
];

/** Keys of {@link DEFAULT_ROLE_TEMPLATES}, for the Swagger enum of `templateKey`. */
export const ROLE_TEMPLATE_KEYS: string[] = DEFAULT_ROLE_TEMPLATES.map(
  (template) => template.key,
);
