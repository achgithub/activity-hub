/**
 * User Presence and Status Types
 */

export type UserStatus = 'online' | 'in_game' | 'away';

export interface UserPresence {
  email: string;
  displayName: string;
  status: UserStatus;
  currentApp?: string;
  lastSeen: number; // Unix timestamp
}
