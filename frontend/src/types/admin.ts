export interface AdminUser {
  email: string;
  name: string;
  roles: string[];
  email_verified: boolean;
  created_at: string;
}

export interface ActivityHubRole {
  id: string;
  name: string;
  description?: string;
  type: 'group' | 'role';
}

export interface RoleAssignment {
  user_email: string;
  role_id: string;
  assigned_by: string;
  assigned_at: string;
}
