/**
 * @activity-hub/core - Awareness Service Types
 * User presence, status, and multiplayer session tracking
 */

export interface UserAwareness {
  userId: string;
  displayName: string;
  status: 'online' | 'in_game' | 'away' | 'offline' | 'do_not_disturb';
  currentApp?: string;
  currentSession?: string;
  lastSeen: number;
  platform?: 'web' | 'ios' | 'android';
}

export interface SessionParticipant {
  userId: string;
  displayName: string;
  joinedAt: number;
  status: 'active' | 'grace_period' | 'left';
}

export interface HeartbeatRequest {
  userId: string;
  displayName: string;
  status: string;
  currentApp?: string;
  platform?: string;
}

export interface StatusChangeRequest {
  status: string;
}

export interface SessionJoinRequest {
  appId: string;
  sessionId: string;
}

export interface SessionLeaveRequest {
  appId: string;
  sessionId: string;
}

export type AwarenessEventType =
  | 'presence_update'
  | 'user_online'
  | 'user_offline'
  | 'participant_joined'
  | 'participant_left'
  | 'participant_reconnected'
  | 'grace_period_expired'
  | 'session_state';

export interface AwarenessEvent {
  type: AwarenessEventType;
  data: UserAwareness | SessionParticipant | any;
  timestamp: number;
}

export const StatusLevels = {
  ONLINE: 'online',
  IN_GAME: 'in_game',
  AWAY: 'away',
  OFFLINE: 'offline',
  DO_NOT_DISTURB: 'do_not_disturb',
} as const;

export const EventTypes = {
  PRESENCE_UPDATE: 'presence_update',
  USER_ONLINE: 'user_online',
  USER_OFFLINE: 'user_offline',
  PARTICIPANT_JOINED: 'participant_joined',
  PARTICIPANT_LEFT: 'participant_left',
  PARTICIPANT_RECONNECTED: 'participant_reconnected',
  GRACE_PERIOD_EXPIRED: 'grace_period_expired',
  SESSION_STATE: 'session_state',
} as const;
