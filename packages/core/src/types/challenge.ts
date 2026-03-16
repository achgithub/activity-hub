/**
 * Challenge and Lobby Types
 */

export interface Challenge {
  id: string;

  // Legacy 2-player fields
  fromUser?: string;
  toUser?: string;

  // Multi-player fields (NEW)
  initiatorId?: string;
  playerIds?: string[];
  accepted?: string[];
  minPlayers?: number;
  maxPlayers?: number;

  appId: string;
  status: 'pending' | 'accepted' | 'rejected' | 'expired' | 'ready' | 'active';
  createdAt: number; // Unix timestamp
  expiresAt: number; // Unix timestamp
}

export interface LobbyState {
  onlineUsers: any[]; // UserPresence[]
  receivedChallenges: Challenge[];
  sentChallenges: Challenge[];
  lastUpdate: number;
}
