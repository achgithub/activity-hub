/**
 * User Authentication and Identity Types
 */

export interface User {
  email: string;
  name: string;
  is_admin?: boolean;
  impersonating?: boolean;
  superUser?: string; // Original super_user email
  is_guest?: boolean; // True for guest users
}

export interface AuthResponse {
  success: boolean;
  token: string;
  user: User;
}

export interface ValidateResponse {
  valid: boolean;
  user?: User;
}
