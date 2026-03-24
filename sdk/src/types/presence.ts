/**
 * User Presence and Status Types
 */

export type UserStatus = 'online' | 'in_game' | 'away' | 'offline' | 'do_not_disturb';

export interface UserPresence {
  email: string;
  displayName: string;
  status: UserStatus;
  currentApp?: string;
  lastSeen: number; // Unix timestamp
}
