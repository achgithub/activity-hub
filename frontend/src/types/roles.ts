/**
 * Role and Group Types for Activity Hub
 */

/**
 * Role identifiers follow patterns:
 * - Activity Hub roles: ah_r_* (ah_r_app_register, ah_r_app_control, etc.)
 * - Activity Hub groups: ah_g_* (ah_g_super, ah_g_admin, etc.)
 * - App-specific roles: app:role (chess:admin, chess:player, leaderboard:guest, etc.)
 */

export interface ActivityHubContext {
  user: {
    email: string;
    name: string;
  };
  roles: {
    // All roles assigned to user (ah_r_*, ah_g_*, app:role)
    all: string[];

    // Activity Hub roles and groups only
    ah_roles: string[];

    // App-specific roles only
    app_roles: string[];

    // Helper functions
    has: (role: string) => boolean; // Check if user has role (exact match)
    hasApp: (role: string) => boolean; // Check if user has app-specific role (e.g., 'admin' checks for 'chess:admin')
    hasAny: (roles: string[]) => boolean; // Check if user has any of the listed roles
    hasAll: (roles: string[]) => boolean; // Check if user has all listed roles

    // Admin check
    isAdmin: boolean; // Has any ah_g_* group or ah_r_app_control
  };
  isTestMode: boolean; // True if admin accessing app (for feature testing)
}

export interface AppRole {
  id: string; // 'chess:admin'
  label: string; // 'Tournament Admin'
  description: string; // 'Manage tournaments, ban players'
  isDefault?: boolean; // Assigned to all users by default
  isRestricted?: boolean; // Can't be self-assigned
}

export interface AppManifest {
  id: string; // App ID
  name: string;
  icon: string;
  description?: string;
  category: 'game' | 'utility' | 'admin';
  realtime?: 'none' | 'sse' | 'websocket';
  minPlayers?: number;
  maxPlayers?: number;
  roles: AppRole[]; // Roles defined by this app
  features?: {
    [featureName: string]: {
      requiredRole?: string; // Role required to access this feature
      description?: string;
    };
  };
}
