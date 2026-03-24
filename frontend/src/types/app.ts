/**
 * Application Definition and Registry Types
 */

export type AppType = 'internal' | 'iframe';
export type RealtimeType = 'websocket' | 'sse' | 'none';

export interface AppDefinition {
  id: string;
  name: string;
  icon: string;
  type: AppType;
  url?: string; // URL template with {host} placeholder
  description: string;
  category: 'game' | 'utility' | 'admin';
  backendPort?: number; // DEPRECATED: Legacy TCP port support, use Unix socket proxy instead
  realtime?: RealtimeType;
  minPlayers?: number; // Minimum players for multi-player games (e.g., 3)
  maxPlayers?: number; // Maximum players for multi-player games (e.g., 6)
  guestAccessible?: boolean; // True if guests can access this app
  enabled?: boolean; // Is app enabled/visible to users (admin only)
  displayOrder?: number; // Display order for sorting
}

export interface AppsRegistry {
  apps: AppDefinition[];
}
